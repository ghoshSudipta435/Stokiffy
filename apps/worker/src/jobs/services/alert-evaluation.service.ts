/**
 * Alert Evaluation Service
 * Evaluates open portfolio holdings and active watchlists using evaluateAlerts from @stock-assistant/core,
 * enforces alert deduplication against unacknowledged alerts, persists new alerts, and writes audit events.
 */

import { prisma as defaultPrisma } from '@stock-assistant/db';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  evaluateAlerts,
  type Alert,
  type PortfolioSnapshot,
  type PositionWithThesis,
} from '@stock-assistant/core';
import type { EvaluatePortfolioAlertsPayload } from '../types.js';
import type { WorkerLogger } from '../../lib/logger.js';

export interface AlertEvaluationResult {
  totalUsers: number;
  totalPositionsEvaluated: number;
  totalNewAlertsCreated: number;
  totalSkippedDuplicates: number;
  createdAlertIds: string[];
}

export class AlertEvaluationService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma as unknown as PrismaClient) {}

  public async evaluate(
    payload: EvaluatePortfolioAlertsPayload,
    logger: WorkerLogger
  ): Promise<AlertEvaluationResult> {
    // 1. Identify target user IDs
    let userIds: string[] = [];
    if (payload.userId) {
      userIds = [payload.userId];
    } else {
      const holdings = await this.prisma.portfolioHolding.findMany({
        select: { userId: true },
        distinct: ['userId'],
      });
      const watchlists = await this.prisma.watchlist.findMany({
        select: { userId: true },
        distinct: ['userId'],
      });
      userIds = Array.from(new Set([...holdings.map((h) => h.userId), ...watchlists.map((w) => w.userId)]));
    }

    logger.info(`Evaluating portfolio alerts for ${userIds.length} user(s)`, { userIds });

    let totalPositionsEvaluated = 0;
    let totalNewAlertsCreated = 0;
    let totalSkippedDuplicates = 0;
    const createdAlertIds: string[] = [];

    for (const userId of userIds) {
      // 2. Fetch portfolio holdings with company metadata
      const holdings = await this.prisma.portfolioHolding.findMany({
        where: { userId },
        include: { company: true },
      });

      totalPositionsEvaluated += holdings.length;

      const positions: PositionWithThesis[] = [];
      const currentPrices: Record<string, number> = {};
      const fundamentalContext: Record<string, { hardStops?: any[] }> = {};

      for (const holding of holdings) {
        // Fetch linked trade plan if available
        const tradePlan = await this.prisma.tradePlan.findFirst({
          where: {
            userId,
            companyId: holding.companyId,
            status: { in: ['ready', 'executed', 'draft'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Fetch latest price bar for the company
        const latestPriceBar = await this.prisma.priceBar.findFirst({
          where: { companyId: holding.companyId },
          orderBy: { date: 'desc' },
        });

        // Fetch active red flags
        const activeFlags = await this.prisma.redFlag.findMany({
          where: {
            companyId: holding.companyId,
            status: 'ACTIVE',
          },
        });

        const currentPrice = latestPriceBar ? Number(latestPriceBar.close) : Number(holding.currentPrice);
        const avgPrice = Number(holding.avgPrice);
        const quantity = Number(holding.quantity);
        const marketValue = quantity * currentPrice;
        const unrealisedPnl = (currentPrice - avgPrice) * quantity;
        const unrealisedPnlPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
        const stopLoss = tradePlan ? Number(tradePlan.stopLoss) : Number(holding.stopLoss);

        let targets: number[] = [];
        if (tradePlan && Array.isArray(tradePlan.targets)) {
          targets = (tradePlan.targets as unknown[])
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0);
        } else if (Array.isArray(holding.targets)) {
          targets = (holding.targets as unknown[])
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 0);
        }

        const entryDate = holding.entryDate ? new Date(holding.entryDate).toISOString() : new Date().toISOString();
        const daysHeld = Math.max(
          0,
          Math.floor((Date.now() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24))
        );

        currentPrices[holding.symbol] = currentPrice;
        currentPrices[holding.companyId] = currentPrice;

        if (activeFlags.length > 0) {
          fundamentalContext[holding.symbol] = {
            hardStops: activeFlags.filter((f) => f.class === 'HARD_STOP'),
          };
        }

        positions.push({
          symbol: holding.symbol,
          companyId: holding.companyId,
          quantity,
          avgPrice,
          currentPrice,
          marketValue,
          sector: holding.sector,
          unrealisedPnl,
          unrealisedPnlPct,
          thesis: tradePlan?.thesis ?? 'Holding position active thesis',
          stopLoss,
          targets,
          entryDate,
          daysHeld,
          unrealisedReturnPct: unrealisedPnlPct,
          alertCount: 0,
          tradePlanId: tradePlan?.id,
        });
      }

      // 3. Construct PortfolioSnapshot
      const totalPortfolioValue = positions.reduce((acc, p) => acc + p.marketValue, 0);
      const sectorExposure: Record<string, number> = {};
      if (totalPortfolioValue > 0) {
        for (const p of positions) {
          sectorExposure[p.sector] =
            (sectorExposure[p.sector] ?? 0) + (p.marketValue / totalPortfolioValue) * 100;
        }
      }

      const portfolioSnapshot: PortfolioSnapshot = {
        totalValue: Math.max(totalPortfolioValue, 1),
        cash: 0,
        positions,
        sectorExposure,
        asOfDate: payload.asOfDate || new Date().toISOString(),
      };

      // 4. Run evaluateAlerts from core
      const evaluatedAlerts: Alert[] = [];
      if (positions.length > 0) {
        const coreAlerts = evaluateAlerts({
          positions,
          portfolio: portfolioSnapshot,
          currentPrices,
          fundamentalContext,
        });
        evaluatedAlerts.push(...coreAlerts);
      }

      // 5. Evaluate Watchlists if enabled
      if (payload.includeWatchlists !== false) {
        const watchlists = await this.prisma.watchlist.findMany({
          where: { userId },
          include: {
            items: {
              include: { company: true },
            },
          },
        });

        for (const wl of watchlists) {
          for (const item of wl.items) {
            const priceBar = await this.prisma.priceBar.findFirst({
              where: { companyId: item.companyId },
              orderBy: { date: 'desc' },
            });
            const price = priceBar ? Number(priceBar.close) : null;
            const itemAny = item as Record<string, unknown>;
            if (price !== null && itemAny.targetPrice !== null && itemAny.targetPrice !== undefined) {
              const target = Number(itemAny.targetPrice);
              if (target > 0 && price >= target) {
                evaluatedAlerts.push({
                  id: `alert_target_${item.companyId}_${Date.now()}`,
                  companyId: item.companyId,
                  symbol: item.company.symbol,
                  type: 'price-target',
                  severity: 'warning',
                  message: `Watchlist target price reached for ${item.company.symbol}! Current price ₹${price} reached target ₹${target}.`,
                  triggeredAt: new Date().toISOString(),
                  data: {
                    currentPrice: price,
                    targetPrice: target,
                    watchlistId: wl.id,
                  },
                });
              }
            }
          }
        }
      }

      // 6. Deduplication: Filter out alerts where an unacknowledged alert of same type and company exists
      const existingUnack = await this.prisma.alert.findMany({
        where: {
          userId,
          acknowledgedAt: null,
        },
        select: {
          type: true,
          companyId: true,
        },
      });

      const existingKey = (type: string, companyId?: string | null) =>
        `${type}::${companyId ?? 'PORTFOLIO'}`;

      const unackKeys = new Set(existingUnack.map((a) => existingKey(a.type, a.companyId)));
      const seenInBatch = new Set<string>();

      const deduplicatedAlerts: Alert[] = [];
      for (const alert of evaluatedAlerts) {
        const key = existingKey(alert.type, alert.companyId);
        if (unackKeys.has(key) || seenInBatch.has(key)) {
          totalSkippedDuplicates++;
          continue;
        }
        seenInBatch.add(key);
        deduplicatedAlerts.push(alert);
      }

      // 7. Persist deduplicated alerts
      const userCreatedAlerts = [];
      for (const alert of deduplicatedAlerts) {
        const created = await this.prisma.alert.create({
          data: {
            userId,
            companyId: alert.companyId ?? null,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            triggeredAt: new Date(alert.triggeredAt || Date.now()),
            data: (alert.data ?? {}) as Prisma.InputJsonValue,
            relatedTradePlanId: alert.relatedTradePlanId ?? null,
          },
        });
        userCreatedAlerts.push(created);
        if (created?.id) {
          createdAlertIds.push(created.id);
        }
      }

      totalNewAlertsCreated += userCreatedAlerts.length;

      // 8. Write AuditEvent summarizing the run
      await this.prisma.auditEvent.create({
        data: {
          userId,
          action: 'EVALUATE_PORTFOLIO_ALERTS',
          entityType: 'Portfolio',
          entityId: userId,
          reason: 'Periodic automated portfolio and watchlist alert evaluation',
          afterState: {
            evaluatedPositionsCount: positions.length,
            newAlertsCreated: userCreatedAlerts.length,
            skippedDuplicatesCount: deduplicatedAlerts.length === 0 && evaluatedAlerts.length > 0 ? evaluatedAlerts.length : seenInBatch.size,
            alertTypes: userCreatedAlerts.map((a) => a.type),
          },
        },
      });

      logger.info(
        `User ${userId}: Evaluated ${positions.length} position(s). Created ${userCreatedAlerts.length} new alert(s), skipped ${deduplicatedAlerts.length < evaluatedAlerts.length ? evaluatedAlerts.length - deduplicatedAlerts.length : 0} duplicate(s).`
      );
    }

    return {
      totalUsers: userIds.length,
      totalPositionsEvaluated,
      totalNewAlertsCreated,
      totalSkippedDuplicates,
      createdAlertIds,
    };
  }
}

export const alertEvaluationService = new AlertEvaluationService();
