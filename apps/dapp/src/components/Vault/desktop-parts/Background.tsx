import particleBackground from './assets/particles.png';

export const Background = () => (
  <g id="background-elements">
    <g id="vault-geometry-background" strokeWidth={1.497} strokeMiterlimit={10}>
      <path
        d="M502.03 927.623c235.058 0 425.61-190.551 425.61-425.609S737.088 76.404 502.03 76.404c-235.058 0-425.61 190.552-425.61 425.61 0 235.058 190.552 425.609 425.61 425.609Z"
        stroke="url(#paint0_radial_4015_16261)"
      />
      <path
        d="M855.583 148.46H148.476v707.107h707.107V148.46Z"
        stroke="url(#paint1_radial_4015_16261)"
      />
      <path
        d="M502 2 2 502l500 500 500-500L502 2Z"
        stroke="url(#paint2_radial_4015_16261)"
      />
      <path
        d="M855.583 148.46H148.476v707.107h707.107V148.46Z"
        stroke="url(#paint3_radial_4015_16261)"
      />
      <path
        d="M502 2 2 502l500 500 500-500L502 2Z"
        stroke="url(#paint4_radial_4015_16261)"
      />
      <path
        d="M664.906 895.214c217.165-89.953 320.291-338.921 230.339-556.086-89.953-217.165-338.921-320.291-556.086-230.339C121.993 198.742 18.868 447.71 108.82 664.875c89.953 217.165 338.921 320.291 556.086 230.339Z"
        stroke="url(#paint5_radial_4015_16261)"
      />
      <path
        d="M693.374 40.062 40.093 310.66 310.69 963.941l653.281-270.598L693.374 40.062Z"
        stroke="url(#paint6_radial_4015_16261)"
      />
      <path
        d="M310.658 40.06 40.06 693.342 693.341 963.94l270.598-653.282L310.658 40.06Z"
        stroke="url(#paint7_radial_4015_16261)"
      />
      <path
        d="M693.374 40.062 40.093 310.66 310.69 963.941l653.281-270.598L693.374 40.062Z"
        stroke="url(#paint8_radial_4015_16261)"
      />
      <path
        d="M310.658 40.06 40.06 693.342 693.341 963.94l270.598-653.282L310.658 40.06Z"
        stroke="url(#paint9_radial_4015_16261)"
      />
    </g>
    <path
      id="particles-background"
      fill="url(#pattern0)"
      fillOpacity={15}
      d="M43.533 42.316h917.649v917.649H43.533z"
    />
    <defs>
      <pattern
        id="pattern0"
        patternContentUnits="objectBoundingBox"
        width={1}
        height={1}
      >
        <use xlinkHref="#image0_4015_16263" transform="scale(.00093)" />
      </pattern>
      <image
        id="image0_4015_16263"
        data-name="particles-background.png"
        width={1080}
        height={1080}
        xlinkHref={particleBackground}
      />
    </defs>
  </g>
);
