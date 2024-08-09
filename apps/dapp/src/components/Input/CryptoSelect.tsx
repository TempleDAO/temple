import { ComponentProps } from 'react';
import Select from 'react-select';
import { theme } from 'styles/theme';

export type Option = {
  value: string | number;
  label: string;
};

export type CryptoSelectOptions = Array<Option>;

export interface CryptoSelectProps {
  onChange?(event: any): void;

  options: CryptoSelectOptions | [];
  defaultValue?: Option;
  // use to limit the number of elements shown in the menu at anytime
  maxMenuItems?: number;
}

type Props = Omit<
  ComponentProps<typeof Select>,
  'classNamePrefix' | 'menuPlacement' | 'theme' | 'styles'
> &
  CryptoSelectProps;

/**
 * UI component for selecting currency to deposit/stake
 */
export const CryptoSelect = (props: Props) => {
  const selectHeight = '2.5rem';
  return (
    <Select
      {...props}
      classNamePrefix={'Select'}
      menuPlacement={'auto'}
      theme={(selectTheme) => ({
        ...selectTheme,
        colors: {
          ...selectTheme.colors,
          primary: theme.palette.brand,
          primary75: theme.palette.brand75,
          primary50: theme.palette.brand50,
          primary25: theme.palette.brand25,
          neutral0: theme.palette.dark,
          neutral10: theme.palette.brand,
          neutral20: theme.palette.brand,
          neutral50: theme.palette.light50,
          neutral80: theme.palette.light,
        },
        borderRadius: 0,
      })}
      styles={{
        control: (base) => ({
          ...base,
          background: `${theme.palette.gradients.dark}`,
          border: `0.0625rem  /* 1/16 */ solid ${theme.palette.brand}`,
          borderRadius: `calc(${selectHeight} / 2)`,
          boxShadow: 'none',
          fontSize: '1.3rem',
          textTransform: 'uppercase',
          textAlign: 'left',
          padding: '0 0.5rem',
          minWidth: '12.5rem  /* 120/16 */',
          cursor: 'pointer',
          height: '3rem',
          zIndex: 2,
        }),
        menu: (base) => ({
          ...base,
          paddingTop: '1.5rem',
          marginTop: '-1.5rem',
          border: `0.0625rem solid ${theme.palette.brand}`,
          borderRadius: '0 0 1.25rem 1.25rem',
        }),
        menuList: (base) => ({
          ...base,
          padding: 0,
          borderRadius: '0 0 1.25rem 1.25rem',
          color: theme.palette.light,
          maxHeight: props.maxMenuItems
            ? `calc(${props.maxMenuItems} * ${selectHeight})`
            : 'none',
          overflowY: 'auto',
        }),
        option: (base, state) => ({
          ...base,
          textAlign: 'center',
          cursor: state.isDisabled ? 'not-allowed' : 'pointer',
          transition: theme.transitions.backgroundColor,
          height: selectHeight,
          borderBottom: `0.0625rem solid ${theme.palette.brand}`,
          fontWeight: 'bold',
          color: theme.palette.brandLight,
          fontSize: '1rem',
        }),
        indicatorSeparator: () => ({
          display: 'none',
        }),
        singleValue: (base, state) => ({
          ...base,
          opacity: state.isDisabled ? 0.5 : 1,
          transition: 'opacity 300ms',
          textAlign: 'center',
          width: '100%',
          color: theme.palette.brandLight,
        }),
        valueContainer: (base) => ({
          ...base,
          padding: 0,
        }),
        dropdownIndicator: (base, state) => ({
          color: state.isFocused
            ? theme.palette.brandLight
            : theme.palette.brand,
          display: 'flex',
          transform: state.isFocused ? 'rotateX(180deg)' : 'none',
          transition: 'transform 250ms linear',
        }),
      }}
    />
  );
};
