export const TimelineStartEndMarkers = () => {
  return (
    <g id="vault-timeline-markers">
      <circle
        id="timeline-start-marker"
        cx={197.948}
        cy={552.414}
        fill="#BD7B4F"
        r={7.649}
      />
      <circle
        id="timeline-end-marker"
        cx={806.059}
        cy={552.414}
        r={7.649}
        fill="#BD7B4F"
      />
      
      <text
        id="START"
        fill="#351F11"
        xmlSpace="preserve"
        style={{
          whiteSpace: "pre",
        }}
        fontFamily="Caviar Dreams"
        fontSize={12}
        fontWeight="bold"
        letterSpacing=".15em"
      >
        <tspan x={175.161} y={526.065}>
          {"START"}
        </tspan>
      </text>
    </g>
  );
};
