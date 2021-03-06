import { useRotationAngle } from '../useRotationAngle';
import { Selector } from './Selector';
import { VaultPage } from '../types';

interface Props {
  selected?: VaultPage;
}

export const InnerRing = ({ selected }: Props) => {
  const [angle, prevAngle, duration, ref] = useRotationAngle(selected, false);
  const transform = `rotate(${angle} 502.066 502.066)`;

  return (
    <g id="vault-inner-ring" transform={transform}>
      <animateTransform
        ref={ref}
        attributeName="transform"
        attributeType="XML"
        type="rotate"
        from={`${prevAngle} 502.066 502.066`}
        to={`${angle} 502.066 502.066`}
        dur={`${duration}ms`}
        repeatCount="1"
        calcMode="spline"
        keySplines=" .4,0, .58,1"
      />
      <g id="bottom-inner-ring">
        <g id="bottom-inner-ring_2" filter="url(#filter11_d_4015_16261)">
          <circle
            cx={502.066}
            cy={502.068}
            r={273.748}
            fill="url(#paint74_radial_4015_16261)"
          />
          <circle
            cx={502.066}
            cy={502.068}
            r={273}
            stroke="#BD7B4F"
            strokeWidth={1.497}
          />
        </g>
        <g id="bottom-inner-ring-tickmarks">
          <path
            d="M243.196 475.578c.051-.512.104-1.023.159-1.535l-11.794-1.239-.161 1.535 11.796 1.239Z"
            fill="url(#paint75_radial_4015_16261)"
          />
          <path
            d="M247.343 448.663c.105-.504.212-1.007.32-1.51l-11.566-2.458-.32 1.51 11.566 2.458Z"
            fill="url(#paint76_radial_4015_16261)"
          />
          <path
            d="M254.298 422.327c.158-.489.316-.979.477-1.467l-11.233-3.65-.477 1.467 11.233 3.65Z"
            fill="url(#paint77_radial_4015_16261)"
          />
          <path
            d="M263.988 396.873c.208-.47.417-.94.628-1.409l-10.798-4.808-.628 1.41 10.798 4.807Z"
            fill="url(#paint78_radial_4015_16261)"
          />
          <path
            d="M276.295 372.587c.256-.446.514-.891.773-1.336l-10.255-5.92-.772 1.336 10.254 5.92Z"
            fill="url(#paint79_radial_4015_16261)"
          />
          <path
            d="M291.082 349.714c.301-.417.604-.833.908-1.248l-9.594-6.97-.907 1.248 9.593 6.97Z"
            fill="url(#paint80_radial_4015_16261)"
          />
          <path
            d="M308.17 328.511c.343-.384.687-.766 1.033-1.147l-8.833-7.953-1.033 1.147 8.833 7.953Z"
            fill="url(#paint81_radial_4015_16261)"
          />
          <path
            d="M327.364 309.203c.381-.346.763-.69 1.147-1.033l-7.953-8.832-1.147 1.032 7.953 8.833Z"
            fill="url(#paint82_radial_4015_16261)"
          />
          <path
            d="M348.466 291.99c.415-.304.831-.607 1.248-.908l-6.97-9.593-1.248.907 6.97 9.594Z"
            fill="url(#paint83_radial_4015_16261)"
          />
          <path
            d="M229.988 501.229h11.883l-.001.771.001.772h-11.883v-1.543Z"
            fill="url(#paint84_radial_4015_16261)"
          />
          <path
            d="m243.196 528.423-11.796 1.239.161 1.535 11.794-1.239c-.055-.512-.108-1.023-.159-1.535Z"
            fill="url(#paint85_radial_4015_16261)"
          />
          <path
            d="m247.344 555.338-11.567 2.458.32 1.51 11.566-2.458c-.108-.503-.214-1.006-.319-1.51Z"
            fill="url(#paint86_radial_4015_16261)"
          />
          <path
            d="m254.298 581.673-11.233 3.65.477 1.468 11.233-3.65c-.16-.488-.319-.978-.477-1.468Z"
            fill="url(#paint87_radial_4015_16261)"
          />
          <path
            d="m263.988 607.128-10.798 4.807.628 1.41 10.799-4.808c-.211-.469-.421-.939-.629-1.409Z"
            fill="url(#paint88_radial_4015_16261)"
          />
          <path
            d="m276.299 631.42-10.258 5.923.772 1.336 10.259-5.923c-.259-.444-.516-.889-.773-1.336Z"
            fill="url(#paint89_radial_4015_16261)"
          />
          <path
            d="m291.082 654.287-9.593 6.97.907 1.248 9.594-6.971c-.304-.415-.606-.831-.908-1.247Z"
            fill="url(#paint90_radial_4015_16261)"
          />
          <path
            d="m308.17 675.49-8.833 7.953 1.033 1.147 8.833-7.953c-.346-.382-.69-.764-1.033-1.147Z"
            fill="url(#paint91_radial_4015_16261)"
          />
          <path
            d="m327.364 694.798-7.953 8.833 1.147 1.032 7.953-8.832c-.383-.343-.766-.687-1.147-1.033Z"
            fill="url(#paint92_radial_4015_16261)"
          />
          <path
            d="m348.467 712.011-6.971 9.594 1.248.907 6.97-9.593-1.247-.908Z"
            fill="url(#paint93_radial_4015_16261)"
          />
          <path
            d="m371.252 726.933-5.921 10.255 1.336.772 5.92-10.254c-.446-.257-.891-.514-1.335-.773Z"
            fill="url(#paint94_radial_4015_16261)"
          />
          <path
            d="m395.464 739.384-4.808 10.799 1.41.628 4.807-10.798c-.47-.208-.94-.418-1.409-.629Z"
            fill="url(#paint95_radial_4015_16261)"
          />
          <path
            d="m420.86 749.226-3.65 11.233 1.468.477 3.65-11.233c-.49-.158-.979-.317-1.468-.477Z"
            fill="url(#paint96_radial_4015_16261)"
          />
          <path
            d="m447.155 756.338-2.46 11.575 1.51.321 2.46-11.576c-.504-.105-1.007-.212-1.51-.32Z"
            fill="url(#paint97_radial_4015_16261)"
          />
          <path
            d="m474.043 760.646-1.239 11.794 1.535.162 1.239-11.797c-.512-.051-1.023-.105-1.535-.159Z"
            fill="url(#paint98_radial_4015_16261)"
          />
          <path
            d="M501.229 762.129v11.884h1.543v-11.884l-.771.002-.772-.002Z"
            fill="url(#paint99_radial_4015_16261)"
          />
          <path
            d="m528.423 760.805 1.239 11.797 1.535-.162-1.239-11.794c-.512.054-1.023.108-1.535.159Z"
            fill="url(#paint100_radial_4015_16261)"
          />
          <path
            d="m555.336 756.658 2.46 11.576 1.51-.321-2.46-11.575c-.503.108-1.006.215-1.51.32Z"
            fill="url(#paint101_radial_4015_16261)"
          />
          <path
            d="m581.673 749.703 3.65 11.233 1.468-.477-3.65-11.233c-.488.16-.978.319-1.468.477Z"
            fill="url(#paint102_radial_4015_16261)"
          />
          <path
            d="m607.128 740.013 4.807 10.798 1.41-.628-4.808-10.799c-.469.211-.939.421-1.409.629Z"
            fill="url(#paint103_radial_4015_16261)"
          />
          <path
            d="m631.42 727.702 5.923 10.258 1.336-.772-5.923-10.259c-.444.259-.889.516-1.336.773Z"
            fill="url(#paint104_radial_4015_16261)"
          />
          <path
            d="m654.287 712.919 6.97 9.593 1.248-.907-6.971-9.594c-.415.304-.83.606-1.247.908Z"
            fill="url(#paint105_radial_4015_16261)"
          />
          <path
            d="m675.49 695.831 7.953 8.832 1.147-1.032-7.953-8.833c-.381.346-.764.69-1.147 1.033Z"
            fill="url(#paint106_radial_4015_16261)"
          />
          <path
            d="m694.798 676.637 8.833 7.953 1.032-1.147-8.832-7.953c-.343.383-.687.766-1.033 1.147Z"
            fill="url(#paint107_radial_4015_16261)"
          />
          <path
            d="m712.011 655.534 9.594 6.971.907-1.248-9.593-6.97c-.302.417-.604.832-.908 1.247Z"
            fill="url(#paint108_radial_4015_16261)"
          />
          <path
            d="m726.929 632.756 10.259 5.923.772-1.336-10.258-5.923c-.256.447-.514.892-.773 1.336Z"
            fill="url(#paint109_radial_4015_16261)"
          />
          <path
            d="m739.385 608.537 10.798 4.808.628-1.41-10.798-4.807c-.208.47-.418.94-.628 1.409Z"
            fill="url(#paint110_radial_4015_16261)"
          />
          <path
            d="m749.226 583.141 11.233 3.65.477-1.468-11.233-3.65c-.158.49-.316.98-.477 1.468Z"
            fill="url(#paint111_radial_4015_16261)"
          />
          <path
            d="m756.339 556.846 11.574 2.46.321-1.51-11.576-2.46c-.105.504-.211 1.007-.319 1.51Z"
            fill="url(#paint112_radial_4015_16261)"
          />
          <path
            d="m760.646 529.958 11.794 1.239.162-1.535-11.796-1.239c-.052.512-.105 1.023-.16 1.535Z"
            fill="url(#paint113_radial_4015_16261)"
          />
          <path
            d="M762.13 502.772h11.883v-1.543H762.13l.001.771-.001.772Z"
            fill="url(#paint114_radial_4015_16261)"
          />
          <path
            d="m760.806 475.578 11.796-1.239-.162-1.535-11.794 1.239c.055.512.108 1.023.16 1.535Z"
            fill="url(#paint115_radial_4015_16261)"
          />
          <path
            d="m756.658 448.665 11.576-2.46-.321-1.51-11.574 2.46c.108.503.214 1.006.319 1.51Z"
            fill="url(#paint116_radial_4015_16261)"
          />
          <path
            d="m749.703 422.327 11.233-3.65-.477-1.467-11.233 3.65c.161.488.32.978.477 1.467Z"
            fill="url(#paint117_radial_4015_16261)"
          />
          <path
            d="m740.013 396.873 10.798-4.807-.628-1.41-10.798 4.808c.211.469.42.939.628 1.409Z"
            fill="url(#paint118_radial_4015_16261)"
          />
          <path
            d="m727.706 372.587 10.254-5.92-.772-1.336-10.255 5.92c.259.445.517.89.773 1.336Z"
            fill="url(#paint119_radial_4015_16261)"
          />
          <path
            d="m712.919 349.714 9.593-6.97-.907-1.248-9.594 6.97c.304.415.607.831.908 1.248Z"
            fill="url(#paint120_radial_4015_16261)"
          />
          <path
            d="m695.831 328.51 8.832-7.952-1.032-1.147-8.833 7.953c.346.381.69.763 1.033 1.146Z"
            fill="url(#paint121_radial_4015_16261)"
          />
          <path
            d="m676.637 309.203 7.953-8.833-1.147-1.032-7.952 8.832c.383.343.765.687 1.146 1.033Z"
            fill="url(#paint122_radial_4015_16261)"
          />
          <path
            d="m655.535 291.99 6.97-9.594-1.248-.907-6.97 9.593c.417.301.833.604 1.248.908Z"
            fill="url(#paint123_radial_4015_16261)"
          />
          <path
            d="m632.756 277.072 5.923-10.259-1.336-.772-5.922 10.258c.446.256.891.514 1.335.773Z"
            fill="url(#paint124_radial_4015_16261)"
          />
          <path
            d="m608.537 264.616 4.808-10.798-1.41-.628-4.807 10.798c.47.208.94.417 1.409.628Z"
            fill="url(#paint125_radial_4015_16261)"
          />
          <path
            d="m583.141 254.774 3.65-11.232-1.468-.477-3.649 11.233c.489.157.979.316 1.467.476Z"
            fill="url(#paint126_radial_4015_16261)"
          />
          <path
            d="m556.848 247.662 2.458-11.565-1.51-.32-2.458 11.566c.504.105 1.007.212 1.51.319Z"
            fill="url(#paint127_radial_4015_16261)"
          />
          <path
            d="m529.958 243.355 1.239-11.794-1.535-.162-1.239 11.796c.512.052 1.023.105 1.535.16Z"
            fill="url(#paint128_radial_4015_16261)"
          />
          <path
            d="M502.772 241.871v-11.883h-1.543v11.883l.772-.001.771.001Z"
            fill="url(#paint129_radial_4015_16261)"
          />
          <path
            d="m475.578 243.195-1.239-11.796-1.535.162 1.239 11.794c.512-.055 1.023-.108 1.535-.16Z"
            fill="url(#paint130_radial_4015_16261)"
          />
          <path
            d="m448.663 247.343-2.458-11.566-1.51.32 2.458 11.565c.503-.107 1.006-.214 1.51-.319Z"
            fill="url(#paint131_radial_4015_16261)"
          />
          <path
            d="m422.327 254.298-3.649-11.233-1.468.477 3.65 11.232c.488-.16.978-.319 1.467-.476Z"
            fill="url(#paint132_radial_4015_16261)"
          />
          <path
            d="m396.873 263.988-4.807-10.798-1.41.628 4.808 10.798c.469-.211.939-.42 1.409-.628Z"
            fill="url(#paint133_radial_4015_16261)"
          />
          <path
            d="m372.587 276.295-5.92-10.254-1.336.772 5.92 10.255c.445-.259.89-.517 1.336-.773Z"
            fill="url(#paint134_radial_4015_16261)"
          />
        </g>
      </g>
      <g id="top-inner-ring">
        <circle
          id="top-inner-ring_2"
          cx={502.066}
          cy={502.068}
          r={259.382}
          fill="url(#paint135_radial_4015_16261)"
          stroke="#BD7B4F"
          strokeWidth={1.497}
        />
        <path
          id="top-inner-ring-geometry"
          d="M717.46 591.76v51.554l1.031-1.567v-51.069l36.087-36.088c.134-.618.268-1.227.392-1.845l-36.52 36.52v-45.13l17.26-41.655 19.755 47.698c.113-.609.237-1.227.351-1.836l-19.591-47.212 19.591-47.192a132.16 132.16 0 0 0-.361-1.836l-19.745 47.687-17.26-41.655v-45.088l36.52 36.52c-.124-.619-.258-1.227-.392-1.846l-36.087-36.087v-51.099l-1.031-1.568v51.554l-31.829-31.84-17.27-41.696 47.676 19.745c-.351-.526-.722-1.031-1.083-1.557l-47.15-19.59-19.539-47.161c-.515-.361-1.031-.732-1.557-1.031l19.755 47.686-41.748-17.229-31.88-31.911h51.615l-1.567-1.031h-51.079l-36.16-36.139-1.856-.392 36.552 36.551h-45.099l-41.686-17.27 47.718-19.765-1.846-.351-47.212 19.59-47.223-19.59-1.846.351 47.718 19.765-41.676 17.27h-45.119l36.541-36.551-1.846.392-36.149 36.159h-51.079c-.526.341-1.031.681-1.567 1.031h51.615l-31.901 31.891-41.666 17.25 19.766-47.707c-.526.35-1.031.721-1.567 1.031l-19.591 47.181-47.181 19.591c-.351.525-.722 1.031-1.031 1.567l47.707-19.766-17.26 41.666-31.87 31.87v-51.615l-1.031 1.567v51.079l-36.17 36.17c-.124.618-.268 1.227-.392 1.845l36.562-36.551v45.047l-17.271 41.697-19.765-47.718c-.124.608-.237 1.227-.351 1.835l19.591 47.223-19.591 47.244c.114.608.237 1.226.351 1.835l19.776-47.728 17.27 41.696v45.12l-36.562-36.552c.124.619.269 1.227.392 1.846l36.17 36.17v51.079c.34.526.681 1.031 1.031 1.567v-51.584l31.963 31.963 17.136 41.552-47.728-19.766c.351.526.722 1.031 1.031 1.567l47.203 19.591 19.538 47.181c.526.361 1.031.732 1.568 1.083l-19.766-47.708 41.655 17.25 31.901 31.901h-51.604l1.567 1.031h51.068l36.088 36.088 1.856.391-36.531-36.53h45.119l41.655 17.26-47.707 19.755 1.846.361 47.212-19.59 47.202 19.59 1.846-.351-47.697-19.755 41.655-17.26h45.099l-36.387 36.582 1.846-.391 36.139-36.088h51.069c.525-.34 1.031-.68 1.567-1.031h-51.553l31.89-31.891 41.686-17.26-19.755 47.687c.526-.351 1.031-.722 1.567-1.082l19.539-47.161 47.171-19.539c.351-.526.722-1.031 1.083-1.567l-47.749 19.652 17.26-41.686 31.912-31.871Zm1.031-130.945 16.693 40.304-16.693 40.305v-80.609Zm-432.543 80.65-16.713-40.346 16.713-40.345v80.691Zm431.512 48.821-30.932 30.932 30.932-74.556v43.624Zm0-178.282v43.635l-30.798-74.463 30.798 30.828Zm-50.522-75.587 16.713 40.346-57.069-57.06 40.356 16.714Zm-75.598-50.522 30.88 30.921-74.494-30.849 43.614-.072Zm-89.156-17.745 40.335 16.714H461.89l40.294-16.714Zm-89.177 17.745h43.727l-74.566 30.921 30.839-30.921Zm-75.577 50.522 40.314-16.703-57.018 57.018 16.704-40.315Zm-50.523 75.556 30.84-30.849-30.84 74.474v-43.625Zm0 178.375v-43.666l30.932 74.546-30.932-30.88Zm50.523 75.577-16.693-40.304 56.997 56.997-40.304-16.693Zm75.577 50.522-30.881-30.87 74.536 30.87h-43.655Zm89.156 17.735-40.315-16.704h80.63l-40.315 16.704Zm89.136-17.735h-43.645l74.504-30.859-30.859 30.859Zm75.587-50.522-40.335 16.714 57.038-57.049-16.703 40.335Zm-42.82 17.745-79.103 32.757h-85.579l-79.145-32.778-60.513-60.513-32.777-79.145V458.32l32.746-79.073 60.534-60.534 79.124-32.767h85.651l79.093 32.757 60.585 60.586 32.747 79.072v85.579l-32.788 79.155-60.575 60.575Z"
          fill="url(#paint136_radial_4015_16261)"
          fillOpacity={0.25}
        />
      </g>
      <Selector />
    </g>
  );
};
