import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * Heatmap: antibodies (rows) × applications (columns), colored by validation count.
 *
 * Props:
 *   data — array of { antibody_id, antibody_label, application, validation_count, success_rate }
 *
 * TODO (your build tasks):
 *   1. Pivot data into a matrix: unique antibodies as rows, applications as columns
 *   2. X scale: scaleBand for applications (WB, IHC, IF, FC, ChIP, ELISA, IP)
 *   3. Y scale: scaleBand for antibody labels (limit to top 15 by total validations)
 *   4. Color scale: d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxCount])
 *   5. Draw rect cells for each antibody×application pair
 *   6. Empty cells = light gray background
 *   7. Hover tooltip: "Vendor Clone — WB: 5 validations (90% positive)"
 *   8. Add axes with rotated x-axis labels
 *   9. This is the most complex viz — save for days 10-12
 */
export default function ValidationHeatmap({ data }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // TODO: Implement heatmap

    svg.attr("viewBox", "0 0 600 400");
    svg.append("text")
      .attr("x", 300).attr("y", 200)
      .attr("text-anchor", "middle")
      .text("Implement heatmap here");

  }, [data]);

  return (
    <div className="chart-container chart-full-width">
      <h3>Validation Coverage Heatmap</h3>
      <svg ref={svgRef} />
    </div>
  );
}
