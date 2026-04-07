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

    const width = 500;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // TODO: Implement area chart, line, data points, axes
    // Hint: d3.area().x(d => xScale(d.pub_year)).y0(innerH).y1(d => yScale(d.count))

    g.append("text")
      .attr("x", (width - margin.left - margin.right) / 2)
      .attr("y", (height - margin.top - margin.bottom) / 2)
      .attr("text-anchor", "middle")
      .text("Implement timeline here");

  }, [data]);

  return (
    <div className="chart-container">
      <h3>Publications Over Time</h3>
      <svg ref={svgRef} />
    </div>
  );
}
