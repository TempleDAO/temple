import Select, { components } from 'react-select';
import styled from 'styled-components';
import { theme } from 'styles/theme';
import BoxIcon from 'assets/icons/box.svg';
import CheckedBoxIcon from 'assets/icons/checkmark-in-box.svg';
import type * as CSS from 'csstype';

export type Option = {
  value: string | number | undefined;
  label: string;
};

export type SelectTempleDaoOptions = Array<Option>;

export interface SelectTempleDaoProps {
  onChange?(event: any): void;
  options: SelectTempleDaoOptions | [];
  defaultValue?: Option[];
  maxMenuItems?: number;
  isSearchable?: boolean;
  width?: CSS.Property.Width;
  fontSize?: CSS.Property.FontSize;
  fontWeight?: CSS.Property.FontWeight;
  textAlign?: CSS.Property.TextAlign;
  zIndex?: CSS.Property.ZIndex;
}

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${theme.palette.brand};
`;

const ValueLabel = styled.div`
  padding-left: 0.5rem;
  color: ${theme.palette.brandLight};
`;

const Icon = styled.img`
  width: 1rem;
  height: 1rem;
`;

export const InputSelect = (props: SelectTempleDaoProps) => {
  const selectHeight = '2rem';

  const CustomOption = (optionProps: any) => {
    const { isSelected, label } = optionProps;
    return (
      <components.Option {...optionProps}>
        <OptionRow>
          <Icon src={isSelected ? CheckedBoxIcon : BoxIcon} alt="" />
          {label}
        </OptionRow>
      </components.Option>
    );
  };

  const CustomValueContainer = ({ children, ...valueProps }: any) => {
    const selected = valueProps.getValue();
    const total = valueProps.options.length;

    let text = '';
    if (selected.length === total) {
      text = 'All auctions';
    } else {
      text = `${selected.length} auction${selected.length === 1 ? '' : 's'}`;
    }

    return (
      <components.ValueContainer {...valueProps}>
        <ValueLabel>{text}</ValueLabel>
      </components.ValueContainer>
    );
  };

  return (
    <Select
      {...props}
      isMulti
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      classNamePrefix={'Select'}
      menuPlacement={'auto'}
      components={{
        Option: CustomOption,
        ValueContainer: CustomValueContainer,
        MultiValue: () => null,
        ClearIndicator: () => null,
      }}
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
          border: `0.0625rem solid ${theme.palette.brand}`,
          borderRadius: `calc(${selectHeight} / 4)`,
          boxShadow: 'none',
          fontSize: '1rem',
          textAlign: 'left',
          padding: '0 0.5rem',
          cursor: 'pointer',
          height: selectHeight,
          zIndex: props.zIndex ? Number(props.zIndex) + 1 : 2,
          width: props.width ?? '100%',
        }),
        menu: (base) => ({
          ...base,
          paddingTop: '1.5rem',
          marginTop: '-1.5rem',
          border: `0.0625rem solid ${theme.palette.brand}`,
          width: props.width ?? '100%',
          zIndex: props.zIndex ?? 1,
          borderBottomLeftRadius: '0.5rem',
          borderBottomRightRadius: '0.5rem',
        }),
        menuList: (base) => ({
          ...base,
          padding: 0,
          color: theme.palette.light,
          maxHeight: props.maxMenuItems
            ? `calc(${props.maxMenuItems} * ${selectHeight})`
            : 'none',
          overflowY: 'auto',
        }),
        option: (base, state) => ({
          ...base,
          textAlign: 'left',
          cursor: state.isDisabled ? 'not-allowed' : 'pointer',
          transition: theme.transitions.backgroundColor,
          height: selectHeight,
          fontWeight: props.fontWeight || 'normal',
          fontSize: props.fontSize,
          backgroundColor: 'transparent',
        }),
        indicatorSeparator: () => ({
          display: 'none',
        }),
        singleValue: (base, state) => ({
          ...base,
          opacity: state.isDisabled ? 0.5 : 1,
          transition: 'opacity 300ms',
          textAlign: props.textAlign ?? 'center',
          width: '100%',
          fontWeight: props.fontWeight || 'normal',
          fontSize: props.fontSize ?? '1.25rem',
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
