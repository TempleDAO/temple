import React from 'react';
import Select from 'react-select';
import { theme } from 'styles/theme';

export type Option = {
  value: string | number;
  label: string;
};

export type SelectTempleDaoOptions = Array<Option>;

export interface SelectTempleDaoProps {
  onChange?(event: any): void;

  options: SelectTempleDaoOptions | [];
  defaultValue?: Option;
  // use to limit the number of elements shown in the menu at anytime
  maxMenuItems?: number;
}

/**
 * Primary UI component for user interaction
 */
/* FIXME(typing): Get the props right `& any` */
export const InputSelect = (props: SelectTempleDaoProps) => {
  const selectHeight = '2.75rem';
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
          fontSize: '1rem',
          textTransform: 'uppercase',
          textAlign: 'left',
          padding: '0 0.5rem',
          minWidth: ' 7.5rem  /* 120/16 */',
          cursor: 'pointer',
          height: selectHeight,
          zIndex: 2, // place it above the menu 👇
        }),
        menu: (base, state) => ({
          ...base,
          paddingTop: '1.5rem',
          marginTop: '-1.5rem',
          border: `0.0625rem solid ${theme.palette.brand}`,
        }),
        menuList: (base, state) => ({
          base,
          padding: 0,
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
          fontWeight: 'bold',
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
