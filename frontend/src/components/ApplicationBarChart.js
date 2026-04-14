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

    const rows = data
      .map((d) => ({
        application: d.application,
        label: d.full_name || d.application,
        count: Number(d.count) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    const width = 500;
    const height = Math.max(220, rows.length * 34 + 60);
    const margin = { top: 20, right: 40, bottom: 30, left: 140 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.count) || 1])
      .range([0, innerW])
      .nice();

    const y = d3
      .scaleBand()
      .domain(rows.map((d) => d.label))
      .range([0, innerH])
      .padding(0.18);

    const color = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(rows, (d) => d.count) || 1]);

    // Axes
    g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y).tickSizeOuter(0))
      .call((sel) => sel.selectAll("text").attr("fill", "currentColor"));

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0));

    // Bars
    const bars = g
      .selectAll("rect.bar")
      .data(rows, (d) => d.label)
      .join("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", (d) => y(d.label))
      .attr("height", y.bandwidth())
      .attr("rx", 6)
      .attr("fill", (d) => color(d.count))
      .attr("width", 0);

    bars
      .transition()
      .duration(650)
      .ease(d3.easeBackOut.overshoot(1.04))
      .attr("width", (d) => x(d.count));

    // Value labels
    const labels = g
      .selectAll("text.value")
      .data(rows, (d) => d.label)
      .join("text")
      .attr("class", "value")
      .attr("x", 0)
      .attr("y", (d) => (y(d.label) || 0) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("fill", "currentColor")
      .attr("opacity", 0.85)
      .style("fontSize", "12px")
      .text((d) => d.count);

    labels
      .transition()
      .duration(650)
      .ease(d3.easeBackOut.overshoot(1.04))
      .attr("x", (d) => Math.min(x(d.count) + 8, innerW - 4))
      .attr("text-anchor", "start");

    // Simple tooltip via <title>
    bars.append("title").text((d) => `${d.label}: ${d.count}`);

  }, [data]);

  return (
    <div className="chart-container">
      <h3>Validations by Application</h3>
      <svg ref={svgRef} />
    </div>
  );
}
