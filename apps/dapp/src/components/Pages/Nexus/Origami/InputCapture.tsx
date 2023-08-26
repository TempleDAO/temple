import { Circle, Line, Ring } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { EventEmitterBase, PointerEventEmitter } from './InputEventEmitter';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Vec2, vec2 } from './vec2';
import { getBisectingLine, makeLineWithLength, rotateLine } from './geometry-helpers';
import { Line2 } from './origami-types';

class PositionEmitter extends EventEmitterBase<'enterPosition' | 'leavePosition', Vec2> {}

const scale = 2.5;
const edge = scale * 2;

export function InputProcessor(props: {
  pointerEventEmitter: PointerEventEmitter
  onFold: (line: Line2) => void
}) {
  const { camera, gl } = useThree();
  const [lockLineStart, setLockLineStart] = useState(false);
  const [lineStart, setLineStart] = useState<Vec2>();
  const [lineEnd, setLineEnd] = useState<Vec2>();

  const position = useMemo(() => {
    const emitter = new PositionEmitter();
    return { emitter } as { emitter: typeof emitter, current?: Vec2 }
  }, []);

  useEffect(() => {
    const pointEventHandler = (e: React.PointerEvent<HTMLElement>) => {
      const clientPt = { x: e.clientX, y: e.clientY };
      const worldPt = getWorldPointOnXYPlane(clientPt, camera, gl);
      const roundedPt = vec2.round(worldPt, scale);
      
      if (position.current) {
        if (vec2.equals(position.current, worldPt)) {
          return;
        } else if (!isControlPoint(position.current) || vec2.distance(position.current, worldPt) > .49) {
          position.emitter.emit('leavePosition', position.current);
          position.current = undefined;
        }
      }
      if (isControlPoint(roundedPt) && vec2.distance(roundedPt, worldPt) < .49) {
        position.current = roundedPt;
        position.emitter.emit('enterPosition', position.current);
      } else {
        position.current = worldPt;
        position.emitter.emit('enterPosition', position.current);
      }
    }
    const listenerKey = props.pointerEventEmitter.addListeners({
      pointermove: pointEventHandler,
      pointerdown: pointEventHandler,
    });

    return () => {
      props.pointerEventEmitter.removeListeners(listenerKey);
    }
  });


  useEffect(() => {
    const pointerListenerKey = props.pointerEventEmitter.addListeners({
      pointerdown: e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.button === 0) {
          if (position.current && lineStart && isControlPoint(lineStart)) {
            if (!lockLineStart) {
              setLockLineStart(true);
            } else if (vec2.distance(position.current, lineStart) < .1) {
              setLineStart(undefined);
            }
          }
          if (lineStart && lineEnd && isControlPoint(lineEnd)) {
            props.onFold([lineStart, lineEnd]);
            setLockLineStart(false);
            setLineStart(undefined);
            setLineEnd(undefined);
          }
        } else {
          setLockLineStart(false);
          setLineStart(undefined);
          setLineEnd(undefined);
        }
      },
    });
    const positionListenerKey = position.emitter.addListeners({
      enterPosition: pt => {
        if (!lockLineStart) {
          setLineStart(pt);
        } else {
          setLineEnd(pt);
        }
      },
      leavePosition: () => {
        if (!lockLineStart) {
          setLineStart(undefined);
        } else {
          setLineEnd(undefined);
        }
      },
    });

    return () => {
      props.pointerEventEmitter.removeListeners(pointerListenerKey);
      position.emitter.removeListeners(positionListenerKey);
    }
  });

  const points = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => {
      return Array.from({ length: 5 }).map((_, j) => {
        const position = vec2.subtract(vec2.scale({ x: i, y: j }, 2.5), { x: edge, y: edge })
        if (isControlPoint(position)) {
          return <Dot key={`${i}-${j}`}
            position={position}
            zPosition={-.1}
            size={.3}
            material={{ color: 0x2df6a7 }} // 0xBD7B4F
            empty
          />;
        } else {
          return
        }
      });
    });
  }, []);

  return <>
    { lineStart && lineEnd && <FoldLine
        start={lineStart}
        end={lineEnd}
      />
    }
    { lineStart && isControlPoint(lineStart) && <Dot
        position={lineStart} zPosition={.1} size={.3}
        material={{ color: 0x2df6a7 }}
      />
    }
    { lineEnd && <Dot
        position={lineEnd} zPosition={.1} size={.3}
        material={{ color: isControlPoint(lineEnd) ? 0x2df6a7 : 'grey' }}
      />
    }
    { points }
  </>
}

function isControlPoint(pt: Vec2) {
  const [absX, absY] = [pt.x, pt.y].map(Math.abs);
  return (absX == edge || absY == edge) && absX <= edge && absY <= edge;
}

function FoldLine(props: {
  start: Vec2,
  end: Vec2,
}) {
  const { start, end } = props;
  const arrowLines = useMemo(() => {
    const bisect = getBisectingLine([start, end]);
    return [bisect,
      makeLineWithLength(rotateLine(bisect, Math.PI / 6), .5),
      makeLineWithLength(rotateLine(bisect, -Math.PI / 6), .5),
    ] as Line2[];
  }, [start, end]);
  const [lineColor, arrowBg, arrowColor] = isControlPoint(end)
    ? [0x2df6a7, 'lightgreen', 'white']
    : ['gray', 'darkgray', 'lightgray']
  
  return <>
    <LineGeom line={[start, end]} z={.1} color={lineColor} lineWidth={5} />
    { arrowLines.map((line, i) => <LineGeom key={i}
        line={line} z={.101} color={arrowBg} lineWidth={12}
      />)
    }
    { arrowLines.map((line, i) => <LineGeom key={i}
        line={line} z={.102} color={arrowColor} lineWidth={2}
      />)
    }
  </>
}

function LineGeom(props: { line: Line2, z: number, color: THREE.ColorRepresentation, lineWidth: number }){
  const { line, z, color, lineWidth } = props;
  const [a, b] = line;
  return <Line points={[[a.x, a.y, z], [b.x, b.y, z]]}
    color={new THREE.Color(color).getHex()} lineWidth={lineWidth} alphaWrite={undefined} 
  />;
}

function Dot(props: {
  position: Vec2,
  zPosition: number,
  size: number,
  // emitter: PositionEmitter
  material: THREE.MeshBasicMaterialParameters
  empty?: boolean
}) {
  const { position, zPosition, size, material, empty } = props;
  if (empty) {
    return <Ring args={[size * .8, size, 16 ]}
      position={[position.x, position.y, zPosition]}
      material={new THREE.MeshBasicMaterial(material)}
    />;
  } else {
    return <Circle args={[size, 16 ]}
      position={[position.x, position.y, zPosition]}
      material={new THREE.MeshBasicMaterial(material)}
    />;
  }
}

function getWorldPointOnXYPlane(
  clientPt: Vec2,
  camera: THREE.Camera,
  gl: THREE.WebGLRenderer,
) {
  const rect = gl.domElement.getBoundingClientRect();
  const x = (clientPt.x - rect.left) / rect.width * 2 - 1;
  const y = -(clientPt.y - rect.top) / rect.height * 2 + 1;
  const point = new THREE.Vector3(x, y, 0).unproject(camera);
  const direction = point.sub(camera.position).normalize();
  const distance = -camera.position.z / direction.z;
  const worldPoint = camera.position.clone().add(direction.multiplyScalar(distance));
  return worldPoint;
};
