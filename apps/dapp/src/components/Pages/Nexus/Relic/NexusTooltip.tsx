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
} from '@floating-ui/react-dom-interactions';
import { mergeRefs } from 'react-merge-refs';
import styled from 'styled-components';

interface Props {
  label: string;
  placement?: Placement;
  children: JSX.Element;
}

export const NexusTooltip = ({ children, label, placement = 'top-start' }: Props) => {
  const [open, setOpen] = useState(false);

  const { x, y, reference, floating, strategy, context } = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    middleware: [offset(5), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context),
    useFocus(context),
    useRole(context, { role: 'tooltip' }),
    useDismiss(context),
  ]);

  // Preserve the consumer's ref
  const ref = useMemo(() => mergeRefs([reference, (children as any).ref]), [reference, children]);

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
          <div
            style={{
              bottom: 0,
              display: 'block',
            }}
          >
            <span style={{ display: 'block', float: 'left', width: '100px' }}>Shard</span>
            <span style={{ display: 'block', float: 'right', width: '100px' }}>shard #1</span>
          </div>
          {/* <div style={{ display: 'absolute', width: '100%' }}> */}
            {/* Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam hendrerit velit ac dolor rhoncus, quis */}
            {/* lobortis ligula tincidunt. Aliquam risus ex.{' '} */}
          {/* </div> */}
          {/* <div>Origin: https://www.foo.com/xyz</div> */}
          {/* <div style={{ backgroundColor: '#000' }}>Origin: https://www.foo.com/xyz</div> */}
        </TooltipContainer>
      )}
    </>
  );
};

const TooltipContainer = styled.div`
  color: '#000000';
  padding: 10px;
  margin: auto;
  max-width: 500px,
  background-color: ${(props) => props.theme.palette.brand};
  border: solid 0.0625rem ${(props) => props.theme.palette.brand};
  border-radius: 15px;
  background-color: #333;
  background-size: cover;
  background-position: center;
`;
