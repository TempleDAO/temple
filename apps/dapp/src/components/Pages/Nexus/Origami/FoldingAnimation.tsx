import { Line, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import paperBackImg from 'assets/images/origami/paper-back.jpg';
import paperFrontImg from 'assets/images/origami/paper-front.jpg';
import { useCallback, useMemo, useRef, useState } from 'react';
import { BufferGeometry, Color, ColorRepresentation, Float32BufferAttribute, Group, MeshBasicMaterial, MeshBasicMaterialParameters, Vector3 } from 'three';
import { RenderInfo } from './FoldingEngine';
import { GeometryInfo, Pair, Shape2 } from './origami-types';

const TARGET_FOLD_ANGLE = Math.PI - 0.01;
const OUTLINE_WIDTH = 3;

export const FoldingAnimation: React.FC<{
  renderInfo: RenderInfo
  onComplete?: () => void
}> = props => {
  const { renderInfo, onComplete } = props;
  const { fixed, moving } = renderInfo;
  const rotationGroupRef = useRef<Group>(null);
  const [active, setActive] = useState(!!renderInfo.moving);
  const rotationState = useMemo(() => ({ angle: 0 }), []);

  const [paperFrontTexture, paperBackTexture] = useTexture([paperFrontImg, paperBackImg]);
  const materialParams: Pair<MeshBasicMaterialParameters> = [
    { 
      color: 'white',
      map: paperFrontTexture,
    },
    {
      color: 0x29b8ed,
      map: paperBackTexture,
    },
  ];

  useFrame(useCallback((_, delta) => {
    const rotationGroup = rotationGroupRef.current
    if (moving && active && rotationGroup) {
      const { axis, center } = moving.rotation;
      const foldSpeed = TARGET_FOLD_ANGLE * delta; // folding complets in 1 second
      rotationState.angle = Math.min(rotationState.angle + foldSpeed, TARGET_FOLD_ANGLE);
      if (rotationState.angle == TARGET_FOLD_ANGLE) {
        setActive(false);
        onComplete && setTimeout(onComplete);
      }
      // Rotate the group around the center and the rotation axis
      rotationGroup.translateX(center.x);
      rotationGroup.translateY(center.y);
      rotationGroup.translateZ(center.z);
      rotationGroup.setRotationFromAxisAngle(axis, rotationState.angle);
      rotationGroup.translateX(-center.x);
      rotationGroup.translateY(-center.y);
      rotationGroup.translateZ(-center.z);
    }
  }, [rotationGroupRef, moving, active, rotationState, onComplete]));

  return (<>
    <group ref={rotationGroupRef}>
    { moving?.geoms.map((geom, i) => <MeshWithOutline key={i}
        geom={geom}
        materialParams={materialParams}
        color={0x29b8ed}
        lineWidth={OUTLINE_WIDTH}
      />)
    }
    </group>
    <group>
    { fixed.map((geom, i) => <MeshWithOutline key={i}
        geom={geom}
        materialParams={materialParams}
        color={0x29b8ed}
        lineWidth={OUTLINE_WIDTH}
      />)
    }
    </group>
  </>);
}

function MeshWithOutline(props: {
  geom: GeometryInfo
  materialParams: Pair<MeshBasicMaterialParameters>
  color: ColorRepresentation
  lineWidth: number
}) {
  const { geom: { shape, z, side }, materialParams, color, lineWidth } = props;
  const shapeGeometry = useMemo(() => makeShapeGeometry(shape, z), [shape, z]);
  const { vertices } = shape;
  const lineZ = z + .0001; // offset z so the outline is drawn on top of the shape
  const points = useMemo(() => [...vertices, vertices[0]].map(p => new Vector3(p.x, p.y, lineZ)), [vertices, z]);
  return <>
    <mesh
      geometry={shapeGeometry}
      material={new MeshBasicMaterial(materialParams[side ? 0 : 1])}
    />
    <Line points={points} color={new Color(color).getHex()} lineWidth={lineWidth} alphaWrite={undefined}/>
  </>
}

function makeShapeGeometry(shape: Shape2, z: number): BufferGeometry {
  const geometry = new BufferGeometry();
  const positions = shape.vertices.map(pt => [pt.x, pt.y, z]);
  geometry.setAttribute('position', new Float32BufferAttribute(positions.flat(), 3));
  const uvCoords = shape.uv.map(pt => [pt.x, pt.y]);
  geometry.setIndex(genIndices(positions.length));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvCoords.flat(), 2));
  return geometry;
}

function genIndices(count: number) {
  const indices: number[] = [];
  for (let i = 0; i < count - 2; i++) {
    indices.push(0)
    indices.push(i + 1)
    indices.push(i + 2)
  }
  return indices;
}
