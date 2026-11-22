/**
 * OHLCV Price-Bar CSV Parser and Validator.
 * Parses daily price bars for technical timing (Stage E) and portfolio monitoring (Stage G).
 * Validates OHLC geometry, positive prices, non-negative volume, and valid dates.
 */

export interface ParsedOHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number | undefined;
}

export interface OHLCVRowError {
  rowNumber: number;
  column?: string | undefined;
  value?: string | undefined;
  message: string;
}

export interface OHLCVParseResult {
  bars: ParsedOHLCVBar[];
  errors: OHLCVRowError[];
  totalRows: number;
  validRows: number;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue.trim());
  return values;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-()]/g, '');
}

export class OHLCVParser {
  private readonly columnMapping?: Record<string, string> | undefined;

  constructor(columnMapping?: Record<string, string> | undefined) {
    this.columnMapping = columnMapping;
  }

  parse(csvContent: string): OHLCVParseResult {
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n');

    const result: OHLCVParseResult = {
      bars: [],
      errors: [],
      totalRows: 0,
      validRows: 0,
    };

    if (lines.length === 0 || !lines[0]?.trim()) {
      return result;
    }

    const headerLine = lines[0]!.trim();
    const rawHeaders = parseCSVLine(headerLine);
    const headerMap = new Map<string, number>();

    rawHeaders.forEach((h, idx) => {
      headerMap.set(normalizeHeader(h), idx);
      if (this.columnMapping && this.columnMapping[h]) {
        headerMap.set(normalizeHeader(this.columnMapping[h]!), idx);
      }
    });

    // Resolve column indexes for required & optional fields
    const getIndex = (aliases: string[]): number | undefined => {
      for (const alias of aliases) {
        const norm = normalizeHeader(alias);
        if (headerMap.has(norm)) {
          return headerMap.get(norm);
        }
      }
      return undefined;
    };

    const dateIdx = getIndex(['date', 'timestamp', 'time', 'datetime']);
    const openIdx = getIndex(['open', 'openprice', 'open_price']);
    const highIdx = getIndex(['high', 'highprice', 'high_price']);
    const lowIdx = getIndex(['low', 'lowprice', 'low_price']);
    const closeIdx = getIndex(['close', 'closeprice', 'close_price']);
    const volumeIdx = getIndex(['volume', 'vol', 'totalvolume']);
    const adjCloseIdx = getIndex([
      'adjustedclose',
      'adjclose',
      'adjusted_close',
      'adj_close',
      'adjusted',
    ]);

    // Validate presence of required headers
    const missingHeaders: string[] = [];
    if (dateIdx === undefined) missingHeaders.push('date');
    if (openIdx === undefined) missingHeaders.push('open');
    if (highIdx === undefined) missingHeaders.push('high');
    if (lowIdx === undefined) missingHeaders.push('low');
    if (closeIdx === undefined) missingHeaders.push('close');
    if (volumeIdx === undefined) missingHeaders.push('volume');

    if (missingHeaders.length > 0) {
      result.errors.push({
        rowNumber: 1,
        message: `Missing required CSV headers: ${missingHeaders.join(', ')}`,
      });
      return result;
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;

      result.totalRows++;
      const rowNumber = i + 1; // 1-indexed line number in CSV
      const cols = parseCSVLine(line);
      const rowErrors: OHLCVRowError[] = [];

      // 1. Date validation
      const rawDate = cols[dateIdx!];
      let isoDate: string | undefined;

      if (!rawDate) {
        rowErrors.push({
          rowNumber,
          column: 'date',
          value: rawDate,
          message: 'Date is required',
        });
      } else {
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          isoDate = `${rawDate}T00:00:00.000Z`;
        } else {
          const parsedTimestamp = Date.parse(rawDate);
          if (isNaN(parsedTimestamp)) {
            rowErrors.push({
              rowNumber,
              column: 'date',
              value: rawDate,
              message: 'Invalid date format (expected YYYY-MM-DD or valid ISO 8601)',
            });
          } else {
            isoDate = new Date(parsedTimestamp).toISOString();
          }
        }
      }

      // 2. Numeric price parsing and validation
      const parsePrice = (
        rawVal: string | undefined,
        colName: string
      ): number | undefined => {
        if (rawVal === undefined || rawVal === '') {
          rowErrors.push({
            rowNumber,
            column: colName,
            value: rawVal,
            message: `${colName} price is required`,
          });
          return undefined;
        }
        const num = Number(rawVal);
        if (!Number.isFinite(num) || isNaN(num) || num <= 0) {
          rowErrors.push({
            rowNumber,
            column: colName,
            value: rawVal,
            message: `${colName} price must be a positive finite number`,
          });
          return undefined;
        }
        return num;
      };

      const open = parsePrice(cols[openIdx!], 'open');
      const high = parsePrice(cols[highIdx!], 'high');
      const low = parsePrice(cols[lowIdx!], 'low');
      const close = parsePrice(cols[closeIdx!], 'close');

      // 3. Volume validation
      const rawVolume = cols[volumeIdx!];
      let volume: number | undefined;

      if (rawVolume === undefined || rawVolume === '') {
        rowErrors.push({
          rowNumber,
          column: 'volume',
          value: rawVolume,
          message: 'Volume is required',
        });
      } else {
        const parsedVol = Number(rawVolume);
        if (!Number.isFinite(parsedVol) || isNaN(parsedVol) || parsedVol < 0) {
          rowErrors.push({
            rowNumber,
            column: 'volume',
            value: rawVolume,
            message: 'Volume must be a non-negative finite number',
          });
        } else {
          volume = parsedVol;
        }
      }

      // 4. Optional adjusted close
      let adjustedClose: number | undefined;
      if (adjCloseIdx !== undefined) {
        const rawAdj = cols[adjCloseIdx];
        if (rawAdj !== undefined && rawAdj !== '') {
          const parsedAdj = Number(rawAdj);
          if (!Number.isFinite(parsedAdj) || isNaN(parsedAdj) || parsedAdj <= 0) {
            rowErrors.push({
              rowNumber,
              column: 'adjustedClose',
              value: rawAdj,
              message: 'Adjusted close price must be a positive finite number',
            });
          } else {
            adjustedClose = parsedAdj;
          }
        }
      }

      // 5. OHLC Geometry validation
      if (
        open !== undefined &&
        high !== undefined &&
        low !== undefined &&
        close !== undefined
      ) {
        if (high < low) {
          rowErrors.push({
            rowNumber,
            column: 'high',
            value: String(high),
            message: `High (${high}) cannot be less than low (${low})`,
          });
        }

        const maxOpenClose = Math.max(open, close);
        if (high < maxOpenClose) {
          rowErrors.push({
            rowNumber,
            column: 'high',
            value: String(high),
            message: `High (${high}) must be >= max(open (${open}), close (${close}))`,
          });
        }

        const minOpenClose = Math.min(open, close);
        if (low > minOpenClose) {
          rowErrors.push({
            rowNumber,
            column: 'low',
            value: String(low),
            message: `Low (${low}) must be <= min(open (${open}), close (${close}))`,
          });
        }
      }

      // If valid, append to bars
      if (
        rowErrors.length === 0 &&
        isoDate !== undefined &&
        open !== undefined &&
        high !== undefined &&
        low !== undefined &&
        close !== undefined &&
        volume !== undefined
      ) {
        const bar: ParsedOHLCVBar = {
          date: isoDate,
          open,
          high,
          low,
          close,
          volume,
          ...(adjustedClose !== undefined ? { adjustedClose } : {}),
        };
        result.bars.push(bar);
        result.validRows++;
      } else {
        result.errors.push(...rowErrors);
      }
    }

    return result;
  }
}

export function parseOHLCVCSV(
  csvContent: string,
  columnMapping?: Record<string, string>
): OHLCVParseResult {
  return new OHLCVParser(columnMapping).parse(csvContent);
}
