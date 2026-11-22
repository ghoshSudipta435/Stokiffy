/**
 * Watchlists API request/response contracts.
 * Supports multi-watchlist management, item tracking, and cross-metric comparison.
 */

import { z } from 'zod';
import { ApiResponseSchema } from './common.js';

// Watchlist item
export const WatchlistItemSchema = z.object({
  id: z.string(),
  watchlistId: z.string(),
  companyId: z.string(),
  notes: z.string().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
  addedAt: z.string().datetime(),
  company: z
    .object({
      id: z.string(),
      symbol: z.string(),
      name: z.string(),
      sector: z.string(),
      currentPrice: z.number().optional(),
    })
    .optional(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

// Full watchlist with optional items
export const WatchlistSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1, 'Watchlist name is required').max(100),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  itemCount: z.number().int().nonnegative().optional(),
  items: z.array(WatchlistItemSchema).optional(),
});
export type Watchlist = z.infer<typeof WatchlistSchema>;

// Create watchlist request
export const CreateWatchlistRequestSchema = z.object({
  name: z.string().min(1, 'Watchlist name is required').max(100),
  description: z.string().max(500).optional(),
  color: z.string().max(50).optional(),
  icon: z.string().max(50).optional(),
});
export type CreateWatchlistRequest = z.infer<typeof CreateWatchlistRequestSchema>;

// Update watchlist request
export const UpdateWatchlistRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
});
export type UpdateWatchlistRequest = z.infer<typeof UpdateWatchlistRequestSchema>;

// Add watchlist item request
export const AddWatchlistItemRequestSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  notes: z.string().max(1000).optional(),
  targetPrice: z.number().positive().optional(),
});
export type AddWatchlistItemRequest = z.infer<typeof AddWatchlistItemRequestSchema>;

// Update watchlist item request
export const UpdateWatchlistItemRequestSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
});
export type UpdateWatchlistItemRequest = z.infer<typeof UpdateWatchlistItemRequestSchema>;

// Response DTOs
export const WatchlistResponseSchema = ApiResponseSchema(WatchlistSchema);
export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>;

export const ListWatchlistsResponseSchema = ApiResponseSchema(z.array(WatchlistSchema));
export type ListWatchlistsResponse = z.infer<typeof ListWatchlistsResponseSchema>;

export const WatchlistItemResponseSchema = ApiResponseSchema(WatchlistItemSchema);
export type WatchlistItemResponse = z.infer<typeof WatchlistItemResponseSchema>;

// Watchlist comparison item
export const WatchlistComparisonItemSchema = z.object({
  companyId: z.string(),
  symbol: z.string(),
  name: z.string(),
  sector: z.string(),
  currentPrice: z.number().optional(),
  peRatio: z.number().nullable().optional(),
  pbRatio: z.number().nullable().optional(),
  rocePct: z.number().nullable().optional(),
  roePct: z.number().nullable().optional(),
  operatingMarginPct: z.number().nullable().optional(),
  stageAScore: z.number().nullable().optional(),
  stageBScore: z.number().nullable().optional(),
  stageCScore: z.number().nullable().optional(),
  fairValue: z.number().nullable().optional(),
  maxBuyPrice: z.number().nullable().optional(),
  technicalSetupQuality: z.enum(['A+', 'A', 'B', 'C']).nullable().optional(),
  gatePassed: z.boolean().optional(),
  activeAlertsCount: z.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  targetPrice: z.number().nullable().optional(),
});
export type WatchlistComparisonItem = z.infer<typeof WatchlistComparisonItemSchema>;

// Watchlist comparison response
export const WatchlistComparisonResponseSchema = ApiResponseSchema(
  z.object({
    watchlistId: z.string(),
    watchlistName: z.string(),
    comparedAt: z.string().datetime(),
    items: z.array(WatchlistComparisonItemSchema),
  })
);
export type WatchlistComparisonResponse = z.infer<typeof WatchlistComparisonResponseSchema>;
