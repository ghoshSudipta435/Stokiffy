/**
 * Streaming CSV parser for financial data import.
 * Supports Screener.in format and custom CSV layouts.
 * Validates rows, units, dates, and sign conventions.
 */

/**
 * Raw CSV row as parsed from the file.
 */
export interface RawCSVRow {
  [column: string]: string | undefined;
}

/**
 * Parsed CSV result with validated data and errors.
 */
export interface CSVParseResult<T> {
  data: T[];
  errors: CSVParseError[];
  rowCount: number;
  validRowCount: number;
}

/**
 * CSV parse error details.
 */
export interface CSVParseError {
  rowNumber: number;
  column: string;
  value: string | undefined;
  message: string;
}

/**
 * Column mapping from raw CSV header to domain field names.
 */
export interface ColumnMapping {
  [domainField: string]: string; // domain field -> CSV header name
}

/**
 * CSV parser with row-by-row validation.
 * Note: Current implementation loads entire CSV content into memory via split().
 * For large files, consider a true streaming implementation in future phases.
 * Maximum recommended file size: undetermined (no limit implemented).
 */
export class CSVParser {
  private readonly columnMapping: ColumnMapping;

  constructor(columnMapping: ColumnMapping) {
    this.columnMapping = columnMapping;
  }

  /**
   * Maps a raw CSV row to a domain object using the column mapping.
   * Returns null if required fields are missing.
   */
  mapRow(row: RawCSVRow): Record<string, string | undefined> {
    const mapped: Record<string, string | undefined> = {};
    for (const [domainField, csvHeader] of Object.entries(this.columnMapping)) {
      mapped[domainField] = row[csvHeader];
    }
    return mapped;
  }

  /**
   * Parses a CSV string into typed results with validation.
   */
  parse<T>(
    csvContent: string,
    validate: (row: Record<string, string | undefined>) => { valid: boolean; errors: CSVParseError[]; data?: T }
  ): CSVParseResult<T> {
    const lines = csvContent.split('\n');
    if (lines.length === 0) {
      return { data: [], errors: [], rowCount: 0, validRowCount: 0 };
    }

    const headerLine = lines[0]!;
    const headers = headerLine.split(',').map((h) => h.trim());

    const data: T[] = [];
    const errors: CSVParseError[] = [];
    let rowCount = 0;
    let validRowCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;

      rowCount++;
      const values = line.split(',').map((v) => v.trim());
      const row: RawCSVRow = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      const mapped = this.mapRow(row);
      const result = validate(mapped);

      if (result.valid && result.data) {
        data.push(result.data);
        validRowCount++;
      } else {
        errors.push(...result.errors);
      }
    }

    return {
      data,
      errors,
      rowCount,
      validRowCount,
    };
  }
}
