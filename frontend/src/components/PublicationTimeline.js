import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * Line/area chart: publication count over time.
 *
 * Props:
 *   data — array of { pub_year, count }
 *
 * TODO (your build tasks):
 *   1. SVG with margins, viewBox for responsiveness
 *   2. X scale: scaleLinear for years
 *   3. Y scale: scaleLinear for counts
 *   4. Draw area fill (d3.area) with gradient from brand color to transparent
 *   5. Draw line path on top (d3.line, curveMonotoneX for smooth)
 *   6. Add circles at each data point with hover interaction
 *   7. Tooltip on hover showing "Year: X, Publications: Y"
 *   8. X axis with year ticks, Y axis with count
 *   9. Animate the path drawing using stroke-dasharray trick
 */
export default function PublicationTimeline({ data }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rows = data
      .map((d) => ({
        pub_year: Number(d.pub_year),
        count: Number(d.count) || 0,
      }))
      .filter((d) => Number.isFinite(d.pub_year))
      .sort((a, b) => a.pub_year - b.pub_year);

    const width = 500;
    const height = 250;
    const margin = { top: 18, right: 20, bottom: 30, left: 44 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain(d3.extent(rows, (d) => d.pub_year))
      .range([0, innerW])
      .nice();

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.count) || 1])
      .range([innerH, 0])
      .nice();

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")).tickSizeOuter(0));

    g.append("g").call(d3.axisLeft(y).ticks(4).tickSizeOuter(0));

    // Gradient fill
    const defs = svg.append("defs");
    const gradId = "timelineGrad";
    const gradient = defs
      .append("linearGradient")
      .attr("id", gradId)
      .attr("x1", "0%")
      .attr("x2", "0%")
      .attr("y1", "0%")
      .attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.35);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.02);

    const area = d3
      .area()
      .x((d) => x(d.pub_year))
      .y0(innerH)
      .y1((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    const line = d3
      .line()
      .x((d) => x(d.pub_year))
      .y((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(rows)
      .attr("fill", `url(#${gradId})`)
      .attr("d", area);

    const linePath = g.append("path")
      .datum(rows)
      .attr("fill", "none")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 2.25)
      .attr("d", line);

    // Animate line draw
    const totalLen = linePath.node()?.getTotalLength?.() || 0;
    if (totalLen) {
      linePath
        .attr("stroke-dasharray", `${totalLen} ${totalLen}`)
        .attr("stroke-dashoffset", totalLen)
        .transition()
        .duration(850)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);
    }

    // Points + simple tooltip via <title>
    g.selectAll("circle.pt")
      .data(rows)
      .join("circle")
      .attr("class", "pt")
      .attr("cx", (d) => x(d.pub_year))
      .attr("cy", (d) => y(d.count))
      .attr("r", 3.3)
      .attr("fill", "#93c5fd")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 1)
      .append("title")
      .text((d) => `Year: ${d.pub_year}\nPublications: ${d.count}`);

  }, [data]);

  return (
    <div className="chart-container">
      <h3>Publications Over Time</h3>
      <svg ref={svgRef} />
    </div>
  );
}
