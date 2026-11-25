import { useMemo, useState } from 'react';

export function formatCompactNumber(value: number, decimals = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString('id-ID', {
      maximumFractionDigits: 1,
    })} jt`;
  }
  if (abs >= 10_000) {
    return `${sign}${(abs / 1_000).toLocaleString('id-ID', {
      maximumFractionDigits: 1,
    })} rb`;
  }
  return value.toLocaleString('id-ID', { maximumFractionDigits: decimals });
}

export interface GroupedBarSeries {
  key: string;
  label: string;
  color: string;
}

export interface GroupedBarDatum {
  category: string;
  subLabel?: string;
  values: Record<string, number>;
}

interface GroupedBarChartProps {
  data: GroupedBarDatum[];
  series: GroupedBarSeries[];
  height?: number;
  unitLabel?: string;
  ariaLabel?: string;
}

export function GroupedBarChart({
  data,
  series,
  height = 260,
  unitLabel = '',
  ariaLabel = 'Grafik batang berkelompok',
}: GroupedBarChartProps) {
  const [hovered, setHovered] = useState<{
    catIdx: number;
    seriesKey: string;
  } | null>(null);

  const chartBounds = useMemo(() => {
    let minVal = 0;
    let maxVal = 0;
    for (const row of data) {
      for (const s of series) {
        const v = row.values[s.key] ?? 0;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    if (maxVal === 0 && minVal === 0) maxVal = 10;
    const span = maxVal - minVal;
    const paddedMax = maxVal > 0 ? maxVal + span * 0.08 : 0;
    const paddedMin = minVal < 0 ? minVal - span * 0.08 : 0;
    return { minVal: paddedMin, maxVal: paddedMax };
  }, [data, series]);

  const svgWidth = 680;
  const svgHeight = height;
  const padLeft = 64;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 46;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const span = Math.max(1, chartBounds.maxVal - chartBounds.minVal);
  const zeroY = padTop + ((chartBounds.maxVal - 0) / span) * plotH;

  const ticks = useMemo(() => {
    const count = 4;
    const arr: number[] = [];
    for (let i = 0; i <= count; i++) {
      arr.push(chartBounds.minVal + (span * i) / count);
    }
    return arr;
  }, [chartBounds.minVal, span]);

  const groupW = data.length > 0 ? plotW / data.length : plotW;
  const barGap = 4;
  const maxBarW = Math.min(28, Math.max(10, (groupW * 0.72) / Math.max(1, series.length) - barGap));
  const totalGroupBarsW =
    series.length * maxBarW + Math.max(0, series.length - 1) * barGap;

  const activeDatum = hovered ? data[hovered.catIdx] : null;
  const activeSeries = hovered
    ? series.find((s) => s.key === hovered.seriesKey)
    : null;

  return (
    <div className="space-y-3">
      {/* Legend & Active Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <div key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="min-h-[20px] font-mono tabular-nums text-xs text-slate-700 dark:text-slate-200">
          {activeDatum && activeSeries ? (
            <span>
              <strong>{activeDatum.category}</strong> · {activeSeries.label}:{' '}
              <strong className="text-cyan-700 dark:text-cyan-300">
                {(activeDatum.values[activeSeries.key] ?? 0).toLocaleString('id-ID')}
                {unitLabel ? ` ${unitLabel}` : ''}
              </strong>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">
              Arahkan kursor ke batang grafik untuk detail angka
            </span>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[460px] select-none"
          role="img"
          aria-label={ariaLabel}
        >
          {/* Horizontal gridlines & Y ticks */}
          {ticks.map((tickVal, idx) => {
            const y = padTop + ((chartBounds.maxVal - tickVal) / span) * plotH;
            const isZero = Math.abs(tickVal) < 0.001;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  x2={svgWidth - padRight}
                  y1={y}
                  y2={y}
                  className={
                    isZero
                      ? 'stroke-slate-300 dark:stroke-slate-700'
                      : 'stroke-slate-200/80 dark:stroke-slate-800'
                  }
                  strokeDasharray={isZero ? undefined : '3 3'}
                  strokeWidth={isZero ? 1.25 : 1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                >
                  {formatCompactNumber(Math.round(tickVal))}
                </text>
              </g>
            );
          })}

          {/* Grouped Bars */}
          {data.map((row, catIdx) => {
            const groupCenterX = padLeft + groupW * catIdx + groupW / 2;
            const startX = groupCenterX - totalGroupBarsW / 2;

            return (
              <g key={row.category}>
                {series.map((s, sIdx) => {
                  const val = row.values[s.key] ?? 0;
                  const valY = padTop + ((chartBounds.maxVal - val) / span) * plotH;
                  const rectY = val >= 0 ? valY : zeroY;
                  const rectH = Math.max(val === 0 ? 2 : 3, Math.abs(valY - zeroY));
                  const x = startX + sIdx * (maxBarW + barGap);
                  const isHovered =
                    hovered?.catIdx === catIdx && hovered?.seriesKey === s.key;
                  const dimmed = hovered !== null && !isHovered;

                  return (
                    <rect
                      key={s.key}
                      x={x}
                      y={rectY}
                      width={maxBarW}
                      height={rectH}
                      rx={3}
                      fill={s.color}
                      opacity={dimmed ? 0.4 : 1}
                      className="transition-opacity duration-150 cursor-pointer"
                      onMouseEnter={() => setHovered({ catIdx, seriesKey: s.key })}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <title>{`${row.category} (${s.label}): ${val.toLocaleString('id-ID')}`}</title>
                    </rect>
                  );
                })}

                <text
                  x={groupCenterX}
                  y={svgHeight - 22}
                  textAnchor="middle"
                  className="fill-slate-800 dark:fill-slate-200 text-[11px] font-semibold"
                >
                  {row.category}
                </text>
                {row.subLabel && (
                  <text
                    x={groupCenterX}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px]"
                  >
                    {row.subLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export interface HorizontalBarDatum {
  label: string;
  subLabel?: string;
  value: number;
  color?: string;
  unit?: string;
}

interface HorizontalBarChartProps {
  data: HorizontalBarDatum[];
  defaultColor?: string;
  negativeColor?: string;
  emptyText?: string;
}

export function HorizontalBarChart({
  data,
  defaultColor = '#0e7490',
  negativeColor = '#dc2626',
  emptyText = 'Belum ada data untuk ditampilkan pada grafik.',
}: HorizontalBarChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        {emptyText}
      </div>
    );
  }

  const maxAbs = Math.max(
    1,
    ...data.map((d) => Math.abs(d.value))
  );

  return (
    <div className="space-y-2.5">
      {data.map((item, idx) => {
        const pct = Math.max(
          item.value === 0 ? 0 : 3,
          Math.min(100, (Math.abs(item.value) / maxAbs) * 100)
        );
        const isNeg = item.value < 0;
        const barColor = isNeg ? negativeColor : item.color || defaultColor;
        const isHovered = hoverIdx === idx;

        return (
          <div
            key={`${item.label}-${idx}`}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
            className={`group rounded-lg px-2 py-1 transition-colors ${
              isHovered ? 'bg-slate-50 dark:bg-slate-800/60' : ''
            }`}
          >
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <div className="min-w-0 flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-slate-400 w-4 shrink-0">
                  {idx + 1}.
                </span>
                <span
                  className="font-medium text-slate-800 dark:text-slate-200 truncate"
                  title={item.label}
                >
                  {item.label}
                </span>
                {item.subLabel && (
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline">
                    · {item.subLabel}
                  </span>
                )}
              </div>
              <span
                className={`font-mono tabular-nums font-semibold shrink-0 ${
                  isNeg
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {item.value.toLocaleString('id-ID', {
                  maximumFractionDigits: 2,
                })}
                {item.unit ? ` ${item.unit}` : ''}
              </span>
            </div>
            <div className="mt-1 h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-opacity duration-150"
                style={{
                  width: `${pct}%`,
                  backgroundColor: barColor,
                  opacity: hoverIdx !== null && !isHovered ? 0.55 : 1,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerTitle: string;
  centerValue: string;
  ariaLabel?: string;
}

export function DonutChart({
  segments,
  centerTitle,
  centerValue,
  ariaLabel = 'Grafik proporsi donat',
}: DonutChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const nonZero = segments.filter((s) => s.value > 0);
  const total = nonZero.reduce((sum, s) => sum + s.value, 0);

  const size = 180;
  const strokeW = 24;
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcs = useMemo(() => {
    let offset = 0;
    return nonZero.map((seg) => {
      const fraction = total > 0 ? seg.value / total : 0;
      const dashLen = fraction * circumference;
      const arc = {
        ...seg,
        fraction,
        dashArray: `${dashLen} ${circumference}`,
        dashOffset: -offset,
      };
      offset += dashLen;
      return arc;
    });
  }, [nonZero, total, circumference]);

  const hoveredSeg = hoverIdx !== null ? arcs[hoverIdx] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeW}
            className="stroke-slate-100 dark:stroke-slate-800"
          />
          {arcs.map((arc, idx) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={hoverIdx === idx ? strokeW + 4 : strokeW}
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
              opacity={hoverIdx !== null && hoverIdx !== idx ? 0.4 : 1}
              className="transition-opacity duration-150 cursor-pointer"
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <title>{`${arc.label}: ${arc.value.toLocaleString('id-ID')} (${Math.round(
                arc.fraction * 100
              )}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate max-w-[100px]">
            {hoveredSeg ? hoveredSeg.label : centerTitle}
          </span>
          <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {hoveredSeg
              ? hoveredSeg.value.toLocaleString('id-ID')
              : centerValue}
          </span>
          {hoveredSeg && (
            <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-300">
              {Math.round(hoveredSeg.fraction * 100)}%
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          const activeIdx = arcs.findIndex((a) => a.label === seg.label);
          return (
            <div
              key={seg.label}
              onMouseEnter={() => activeIdx >= 0 && setHoverIdx(activeIdx)}
              onMouseLeave={() => setHoverIdx(null)}
              className="flex items-center justify-between gap-3 text-xs px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden="true"
                />
                <span className="text-slate-700 dark:text-slate-200 font-medium truncate">
                  {seg.label}
                </span>
              </div>
              <div className="font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                <strong className="text-slate-900 dark:text-slate-100">
                  {seg.value.toLocaleString('id-ID')}
                </strong>{' '}
                <span className="text-slate-400">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface VerticalBarPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  highlight?: boolean;
  muted?: boolean;
}

interface VerticalBarChartProps {
  data: VerticalBarPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
  unit?: string;
  ariaLabel?: string;
}

export function VerticalBarChart({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#0e7490',
  secondaryColor = '#d97706',
  height = 220,
  unit = '',
  ariaLabel = 'Grafik batang tren waktu',
}: VerticalBarChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    let m = 1;
    for (const d of data) {
      if (d.value > m) m = d.value;
      if (d.secondaryValue && d.secondaryValue > m) m = d.secondaryValue;
    }
    return m * 1.1;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        Belum ada titik data untuk grafik tren.
      </div>
    );
  }

  const svgWidth = 720;
  const svgHeight = height;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 38;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const slotW = plotW / data.length;
  const hasSecondary = Boolean(secondaryLabel);
  const barW = hasSecondary
    ? Math.max(4, Math.min(18, slotW * 0.36))
    : Math.max(6, Math.min(34, slotW * 0.65));

  const labelStep = data.length > 18 ? Math.ceil(data.length / 12) : 1;
  const activePoint = hoverIdx !== null ? data[hoverIdx] : null;

  const tickDecimals = maxVal < 20 ? 2 : maxVal < 100 ? 1 : 0;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-xs"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {primaryLabel}
            </span>
          </div>
          {secondaryLabel && (
            <div className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs"
                style={{ backgroundColor: secondaryColor }}
              />
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {secondaryLabel}
              </span>
            </div>
          )}
        </div>

        <div className="font-mono tabular-nums text-xs text-slate-700 dark:text-slate-200 min-h-[18px]">
          {activePoint ? (
            <span>
              <strong>{activePoint.label}</strong> · {primaryLabel}:{' '}
              <strong className="text-cyan-700 dark:text-cyan-300">
                {activePoint.value.toLocaleString('id-ID', {
                  maximumFractionDigits: 3,
                })}
                {unit ? ` ${unit}` : ''}
              </strong>
              {secondaryLabel && activePoint.secondaryValue !== undefined && (
                <>
                  {' '}
                  · {secondaryLabel}:{' '}
                  <strong className="text-amber-700 dark:text-amber-300">
                    {activePoint.secondaryValue.toLocaleString('id-ID', {
                      maximumFractionDigits: 3,
                    })}
                    {unit ? ` ${unit}` : ''}
                  </strong>
                </>
              )}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">
              Arahkan kursor untuk detail nilai
            </span>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[460px] select-none"
          role="img"
          aria-label={ariaLabel}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = maxVal * ratio;
            const y = padTop + plotH - ratio * plotH;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  x2={svgWidth - padRight}
                  y1={y}
                  y2={y}
                  className={
                    ratio === 0
                      ? 'stroke-slate-300 dark:stroke-slate-700'
                      : 'stroke-slate-200/80 dark:stroke-slate-800'
                  }
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                >
                  {formatCompactNumber(
                    tickDecimals === 0 ? Math.round(val) : val,
                    tickDecimals
                  )}
                </text>
              </g>
            );
          })}

          {data.map((pt, idx) => {
            const cx = padLeft + slotW * idx + slotW / 2;
            const h1 = (pt.value / maxVal) * plotH;
            const y1 = padTop + plotH - h1;
            const isHovered = hoverIdx === idx;
            const dimmed = hoverIdx !== null && !isHovered;

            return (
              <g
                key={`${pt.label}-${idx}`}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                className="cursor-pointer"
              >
                {/* Invisible hit column */}
                <rect
                  x={padLeft + slotW * idx}
                  y={padTop}
                  width={slotW}
                  height={plotH}
                  fill="transparent"
                />

                {hasSecondary ? (
                  <>
                    <rect
                      x={cx - barW - 1}
                      y={y1}
                      width={barW}
                      height={Math.max(pt.value > 0 ? 2 : 0, h1)}
                      rx={2}
                      fill={primaryColor}
                      opacity={dimmed ? 0.4 : 1}
                      className="transition-opacity duration-150"
                    />
                    {pt.secondaryValue !== undefined && (
                      <rect
                        x={cx + 1}
                        y={padTop + plotH - (pt.secondaryValue / maxVal) * plotH}
                        width={barW}
                        height={Math.max(
                          pt.secondaryValue > 0 ? 2 : 0,
                          (pt.secondaryValue / maxVal) * plotH
                        )}
                        rx={2}
                        fill={secondaryColor}
                        opacity={dimmed ? 0.4 : 1}
                        className="transition-opacity duration-150"
                      />
                    )}
                  </>
                ) : (
                  <rect
                    x={cx - barW / 2}
                    y={y1}
                    width={barW}
                    height={Math.max(pt.value > 0 ? 2 : 0, h1)}
                    rx={2.5}
                    fill={
                      pt.highlight
                        ? '#4338ca'
                        : pt.muted
                        ? '#f59e0b'
                        : primaryColor
                    }
                    opacity={dimmed ? 0.4 : 1}
                    className="transition-opacity duration-150"
                  />
                )}

                {idx % labelStep === 0 && (
                  <text
                    x={cx}
                    y={svgHeight - 14}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export interface MultiLineSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

export interface MultiLinePoint {
  label: string;
  values: Record<string, number | null>;
}

interface MultiLineChartProps {
  data: MultiLinePoint[];
  series: MultiLineSeries[];
  height?: number;
  unit?: string;
  decimals?: number;
  ariaLabel?: string;
}

export function MultiLineChart({
  data,
  series,
  height = 250,
  unit = '',
  decimals = 2,
  ariaLabel = 'Grafik garis perbandingan target dan realisasi',
}: MultiLineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const bounds = useMemo(() => {
    let minVal = 0;
    let maxVal = 0;
    let hasPositive = false;
    for (const pt of data) {
      for (const s of series) {
        const v = pt.values[s.key];
        if (v === null || v === undefined || !Number.isFinite(v)) continue;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
        hasPositive = true;
      }
    }
    if (!hasPositive || maxVal === minVal) {
      maxVal = minVal + 10;
    }
    const span = maxVal - minVal;
    return {
      minVal: minVal < 0 ? minVal - span * 0.08 : 0,
      maxVal: maxVal + span * 0.08,
    };
  }, [data, series]);

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        Belum ada titik data untuk grafik garis.
      </div>
    );
  }

  const svgWidth = 720;
  const svgHeight = height;
  const padLeft = 58;
  const padRight = 22;
  const padTop = 16;
  const padBottom = 38;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const span = Math.max(0.0001, bounds.maxVal - bounds.minVal);
  const tickDecimals = span < 20 ? 2 : span < 100 ? 1 : 0;

  const getX = (idx: number) =>
    data.length === 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (data.length - 1)) * plotW;
  const getY = (val: number) =>
    padTop + ((bounds.maxVal - val) / span) * plotH;

  const activePoint = hoverIdx !== null ? data[hoverIdx] : null;
  const slotW = data.length > 1 ? plotW / data.length : plotW;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <div key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="w-3.5 h-0.5 shrink-0"
                style={{
                  backgroundColor: s.dashed ? 'transparent' : s.color,
                  borderTop: s.dashed ? `2px dashed ${s.color}` : undefined,
                }}
                aria-hidden="true"
              />
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="font-mono tabular-nums text-xs text-slate-700 dark:text-slate-200 min-h-[18px]">
          {activePoint ? (
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <strong className="text-slate-900 dark:text-slate-100">
                {activePoint.label}
              </strong>
              {series.map((s) => {
                const v = activePoint.values[s.key];
                if (v === null || v === undefined) return null;
                return (
                  <span key={s.key}>
                    <span className="text-slate-400">{s.label}:</span>{' '}
                    <strong style={{ color: s.color }}>
                      {v.toLocaleString('id-ID', {
                        maximumFractionDigits: decimals,
                      })}
                      {unit ? ` ${unit}` : ''}
                    </strong>
                  </span>
                );
              })}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">
              Arahkan kursor pada bulan untuk detail kurva
            </span>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[460px] select-none"
          role="img"
          aria-label={ariaLabel}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = bounds.minVal + span * ratio;
            const y = padTop + plotH - ratio * plotH;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  x2={svgWidth - padRight}
                  y1={y}
                  y2={y}
                  className={
                    ratio === 0
                      ? 'stroke-slate-300 dark:stroke-slate-700'
                      : 'stroke-slate-200/80 dark:stroke-slate-800'
                  }
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                >
                  {formatCompactNumber(
                    tickDecimals === 0 ? Math.round(val) : val,
                    tickDecimals
                  )}
                </text>
              </g>
            );
          })}

          {hoverIdx !== null && (
            <line
              x1={getX(hoverIdx)}
              x2={getX(hoverIdx)}
              y1={padTop}
              y2={padTop + plotH}
              className="stroke-slate-400/70 dark:stroke-slate-600"
              strokeDasharray="3 3"
            />
          )}

          {/* Series Paths */}
          {series.map((s) => {
            const pts: Array<{ x: number; y: number; val: number; idx: number }> = [];
            data.forEach((pt, idx) => {
              const v = pt.values[s.key];
              if (v !== null && v !== undefined && Number.isFinite(v)) {
                pts.push({ x: getX(idx), y: getY(v), val: v, idx });
              }
            });
            if (pts.length === 0) return null;
            const d = pts
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(' ');

            return (
              <g key={s.key}>
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.dashed ? 2 : 2.5}
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pts.map((p) => (
                  <circle
                    key={`${s.key}-${p.idx}`}
                    cx={p.x}
                    cy={p.y}
                    r={hoverIdx === p.idx ? 5 : 3.2}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            );
          })}

          {/* X Axis Labels & Hit Targets */}
          {data.map((pt, idx) => {
            const cx = getX(idx);
            const hitX =
              data.length === 1
                ? padLeft
                : Math.max(padLeft, cx - slotW / 2);
            const hitW =
              data.length === 1
                ? plotW
                : Math.min(svgWidth - padRight - hitX, slotW);
            return (
              <g
                key={`${pt.label}-${idx}`}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={hitX}
                  y={padTop}
                  width={Math.max(8, hitW)}
                  height={plotH + 24}
                  fill="transparent"
                />
                <text
                  x={cx}
                  y={svgHeight - 14}
                  textAnchor="middle"
                  className={`text-[10px] font-mono ${
                    hoverIdx === idx
                      ? 'fill-cyan-700 dark:fill-cyan-300 font-bold'
                      : 'fill-slate-500 dark:fill-slate-400'
                  }`}
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

