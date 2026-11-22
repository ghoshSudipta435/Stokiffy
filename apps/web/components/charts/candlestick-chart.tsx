'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineStyle,
  LineWidth,
  Time,
} from 'lightweight-charts';
import type { PriceBar } from '@stock-assistant/contracts';

interface ReferenceLine {
  price: number;
  color: string;
  label: string;
}

interface CandlestickChartProps {
  priceBars: PriceBar[];
  referenceLines?: ReferenceLine[];
  height?: number;
}

const CANDLESTICK_COLORS = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  borderVisible: false,
  wickUpColor: '#22c55e',
  wickDownColor: '#ef4444',
};

const VOLUME_COLOR = '#64748b';

const TIME_FORMAT = (d: string) => d.slice(0, 10); // 'YYYY-MM-DD'

export function CandlestickChart({
  priceBars,
  referenceLines = [],
  height = 320,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLineRefs = useRef<Map<string, IPriceLine>>(new Map());

  const updateSize = useCallback(() => {
    const container = containerRef.current;
    const chart = chartRef.current;
    if (!container || !chart) return;
    const { width, height: clientHeight } = container.getBoundingClientRect();
    chart.applyOptions({ width, height: clientHeight });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#e2e8f0',
        fontSize: 11,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      width: container.clientWidth || 320,
      height,
      rightPriceScale: {
        scaleMargins: { top: 0.2, bottom: 0.25 },
        borderVisible: false,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      handleScroll: false,
      handleScale: false,
      localization: { priceFormatter: (price: number) => `₹${price.toFixed(0)}` },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: CANDLESTICK_COLORS.upColor,
      downColor: CANDLESTICK_COLORS.downColor,
      borderVisible: CANDLESTICK_COLORS.borderVisible,
      wickUpColor: CANDLESTICK_COLORS.wickUpColor,
      wickDownColor: CANDLESTICK_COLORS.wickDownColor,
    });
    candlestickSeriesRef.current = candlestickSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: VOLUME_COLOR,
    });
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRefs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useEffect(() => {
    const candlestickSeries = candlestickSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candlestickSeries || !volumeSeries) return;

    const candleData = priceBars.map((bar) => ({
      time: TIME_FORMAT(bar.date) as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));
    candlestickSeries.setData(candleData);

    const volumeData = priceBars.map((bar) => ({
      time: TIME_FORMAT(bar.date) as Time,
      value: bar.volume,
      color: bar.close >= bar.open ? CANDLESTICK_COLORS.upColor : CANDLESTICK_COLORS.downColor,
    }));
    volumeSeries.setData(volumeData);
  }, [priceBars]);

  useEffect(() => {
    const candlestickSeries = candlestickSeriesRef.current;
    if (!candlestickSeries) return;

    const currentKeys = new Set(referenceLines.map((l) => l.label));
    priceLineRefs.current.forEach((line, key) => {
      if (!currentKeys.has(key)) {
        candlestickSeries.removePriceLine(line);
        priceLineRefs.current.delete(key);
      }
    });

    referenceLines.forEach((line) => {
      const existing = priceLineRefs.current.get(line.label);
      const options = {
        price: line.price,
        color: line.color,
        lineWidth: 1 as LineWidth,
        lineStyle: LineStyle.Dashed,
        lineVisible: true,
        axisLabelVisible: true,
        title: line.label,
        axisLabelColor: line.color,
        axisLabelTextColor: '#e2e8f0',
        hitTestTolerance: 7,
      };
      if (existing) {
        existing.applyOptions(options);
      } else {
        const newLine = candlestickSeries.createPriceLine(options);
        priceLineRefs.current.set(line.label, newLine);
      }
    });
  }, [referenceLines]);

  if (!priceBars || priceBars.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-[320px] items-center justify-center rounded-lg bg-slate-950 border border-slate-800"
      >
        <p className="text-xs text-slate-500 font-mono">
          No price data available. Import OHLCV CSV to view the candlestick chart.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-lg bg-slate-950 border border-slate-800 h-[${height}px] w-full`}
    />
  );
}
