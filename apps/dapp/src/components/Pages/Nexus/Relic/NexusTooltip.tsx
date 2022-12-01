import { cloneElement, useMemo, useState } from 'react';
import {
  Placement,
  offset,
  flip,
  shift,
  autoUpdate,
  useFloating,
  useInteractions,
  useHover,
  useFocus,
  useRole,
  useDismiss,
  safePolygon,
} from '@floating-ui/react-dom-interactions';
import { mergeRefs } from 'react-merge-refs';
import styled from 'styled-components';
import { RARITY_TYPE, Shard } from '../types';

interface Props {
  shard: Shard;
  placement?: Placement;
  children: JSX.Element;
}

export const NexusTooltip = ({ children, shard, placement = 'top-start' }: Props) => {
  const [open, setOpen] = useState(false);

  const { x, y, reference, floating, strategy, context } = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    middleware: [offset(5), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, {
      handleClose: safePolygon({
        restMs: 50,
      }),
    }),
    useFocus(context),
    useRole(context, { role: 'tooltip' }),
    useDismiss(context),
  ]);

  // Preserve the consumer's ref
  const ref = useMemo(() => mergeRefs([reference, (children as any).ref]), [reference, children]);

  const getRarityColor = (rarity: RARITY_TYPE) => {
    switch (rarity) {
      case RARITY_TYPE.EPIC:
        return '#7e3289';
      default:
        return '#7e3289';
    }
  };

  return (
    <>
      {cloneElement(children, getReferenceProps({ ref, ...children.props }))}
      {open && (
        <TooltipContainer
          ref={floating}
          style={{
            position: strategy,
            top: y ?? 0,
            left: x ?? 0,
          }}
          {...getFloatingProps()}
        >
          <CellRow>
            <RowText align={'left'} bold={true}>
              {shard.name}
            </RowText>
            <RowText align={'right'} bold={true}>
              Shard #{shard.id}
            </RowText>
          </CellRow>
          <CellRow>
            <DescriptionContainer>
              <span>{shard.description}</span>
            </DescriptionContainer>
          </CellRow>
          <CellRow>
            <RowText>
              Origin: <OriginLink href={`https://www.foo.com/xyz`}>https://www.foo.com/xyz</OriginLink>
            </RowText>
          </CellRow>
          <CellRow>
            <Circle color={getRarityColor(shard.rarity)} />
            <RarityText color={getRarityColor(shard.rarity)}>{RARITY_TYPE[shard.rarity]}</RarityText>
          </CellRow>
        </TooltipContainer>
      )}
    </>
  );
};

const RarityText = styled.span<{ color?: string }>`
  font-weight: bold;
  text-align: left;
  flex: 1;
  color: ${(props) => (props.color ? props.color : props.theme.palette.brand)};
`;

const Circle = styled.div<{ color?: string }>`
  width: 20px;
  height: 20px;
  background-color: ${(props) => (props.color ? props.color : 'green')};
  border-radius: 50%;
  margin-right: 10px;
`;

const OriginLink = styled.a`
  color: #2f6db3;
  font-weight: normal;
`;

const DescriptionContainer = styled.div`
  display: flex;
`;

const CellRow = styled.div`
  padding: 10px;
  display: flex;
  justify-content: space-between;
`;

const RowText = styled.span<{ align?: string; bold?: boolean }>`
  font-weight: ${(props) => (props.bold ? 'bold' : 'normal')};
  text-align: ${(props) => (props.align === 'right' ? 'right' : 'left')};
  flex: 1;
`;

const TooltipContainer = styled.div`
  color: ${(props) => props.theme.palette.brand};
  padding: 10px;
  margin: auto;
  max-width: 500px,
  background-color: ${(props) => props.theme.palette.brand};
  background-color: #000000;
  border: solid 0.0625rem ${(props) => props.theme.palette.brand75};
  border-radius: 15px;
  background-size: cover;
  background-position: center;
  max-width: 400px
`;
