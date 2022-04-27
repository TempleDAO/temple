import React from 'react';
import Select from 'react-select';
import { theme } from '../../styles/theme';

export type Option = {
  value: string | number;
  label: string;
};

export type SelectTempleDaoOptions = Array<Option>;

interface SelectTempleDaoProps {
  onChange?(event: any): void;

  options: SelectTempleDaoOptions | [];
  defaultValue?: Option;
  isSmall?: boolean;
}

/**
 * Primary UI component for user interaction
 */
/* FIXME(typing): Get the props right `& any` */
export const InputSelect = (props: SelectTempleDaoProps) => {
  return (
    <Select
      {...props}
      classNamePrefix={'Select'}
      theme={(selectTheme) => ({
        ...selectTheme,
        borderRadius: 0,
        colors: {
          ...selectTheme.colors,
          primary: theme.palette.brand,
          primary75: theme.palette.brand75,
          primary50: theme.palette.brand50,
          primary25: theme.palette.brand25,
          neutral0: theme.palette.dark,
          neutral10: theme.palette.brand,
          neutral20: theme.palette.light,
          neutral50: theme.palette.light50,
          neutral80: theme.palette.light,
        },
      })}
      /* TODO: Clean the styles DRYit */
      styles={{
        control: (base) => ({
          ...base,
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          fontFamily: 'Megant',
          fontSize: 24,
          textTransform: 'uppercase',
          textAlign: 'left',
        }),
        menu: (base, state) => ({
          ...base,
          marginTop: 0,
        }),
        menuList: (base, state) => ({
          padding: 0,
          color: theme.palette.light,
        }),
        option: (base, state) => ({
          ...base,
          textAlign: 'left',
          fontFamily: 'Megant',
          textTransform: 'uppercase',
          cursor: state.isDisabled ? 'not-allowed' : 'pointer',
          transition: theme.transitions.backgroundColor,
        }),
        indicatorSeparator: () => ({
          display: 'none',
        }),
        singleValue: (base, state) => ({
          ...base,
          opacity: state.isDisabled ? 0.5 : 1,
          transition: 'opacity 300ms',
          fontFamily: 'Megant',
          fontSize: props.isSmall ? '1.2rem' : '1.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: theme.palette.brand,
          margin: 0,
        }),
        valueContainer: (base) => ({
          ...base,
          justifyContent: 'flex-start',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
        }),
      }}
    />
  );
};
