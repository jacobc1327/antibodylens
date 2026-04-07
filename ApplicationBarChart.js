import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * Horizontal bar chart: validation counts by application type.
 *
 * Props:
 *   data — array of { application, full_name, count }
 *
 * TODO (your build tasks):
 *   1. Set up SVG with margins (40, 120, 30, 20) for axis labels
 *   2. X scale: linear, domain [0, max count]
 *   3. Y scale: band, domain = application full names
 *   4. Draw horizontal bars with transition (duration 600ms, easeBackOut)
 *   5. Color bars using a sequential scale (d3.interpolateBlues)
 *   6. Add count labels at end of each bar
 *   7. Add axes (left axis = app names, bottom axis = count)
 *   8. Add hover tooltip showing exact count
 */
export default function ApplicationBarChart({ data }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 500;
    const height = Math.max(200, data.length * 40);
    const margin = { top: 20, right: 40, bottom: 30, left: 140 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // TODO: Implement scales, bars, axes, labels, transitions
    // This is the core D3 work — reference d3js.org/d3-scale
    // Hint: use d3.scaleBand for y, d3.scaleLinear for x

    // Placeholder text — remove when you implement
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH / 2)
      .attr("text-anchor", "middle")
      .text("Implement bar chart here");

  }, [data]);

  return (
    <div className="chart-container">
      <h3>Validations by Application</h3>
      <svg ref={svgRef} />
    </div>
  );
}
