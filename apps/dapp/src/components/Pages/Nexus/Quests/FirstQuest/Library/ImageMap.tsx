import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import Modal from 'react-modal';
import Image from 'components/Image/Image';
import Book from './Book';
import { Button } from 'components/Button/Button';
import { Link } from 'react-router-dom';
import { clickSound } from 'utils/sound';

type Hotspot = {
  points: string[];
};

type ImageMapProps = {
  imageSrc: string;
  imageSrcHover: string[];
  hotspots: Hotspot[];
};

const setsAreEqual = (setA: Set<Number>, setB: Set<Number>) =>
  setA.size === setB.size && [...setA].every((x) => setB.has(x));

const ImageMap = ({ imageSrc, imageSrcHover, hotspots }: ImageMapProps) => {
  const [hover, setHover] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [bookIndex, setBookIndex] = useState(0);
  const [clickedBooks, setClickedBooks] = useState(new Set<Number>());
  const requiredBookIds = new Set([0, 1, 2, 3, 4, 5]);
  const [allBooksClicked, setAllBooksClicked] = useState(false);

  const handleMouseEnter = (bookIndex: number) => {
    setBookIndex(bookIndex);
    setHover(true);
  };

  const handleMouseLeave = (bookIndex: number) => {
    setHover(false);
  };

  const handleModalOpen = (bookIndex: number) => {
    clickSound.play();
    setClickedBooks((previousState) => new Set([...previousState, bookIndex]));
    setModalIsOpen(true);
  };

  const handleModalClose = () => {
    setModalIsOpen(false);
  };

  useEffect(() => {
    if (setsAreEqual(clickedBooks, requiredBookIds)) {
      setAllBooksClicked(true);
    }
  }, [clickedBooks]);

  const modalStyle = {
    content: {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      marginRight: '-50%',
      width: 1260,
      height: 834,
      transform: 'translate(-50%, -50%)',
      padding: '0px',
      border: '',
      backgroundColor: 'transparent',
    },
  };

  return (
    <>
      <LibraryContainer style={{ position: 'relative' }}>
        {allBooksClicked && (
          <Link to={'/nexus/quests/quiz'}>
            <AllDoneButton playClickSound>Test Your Knowledge</AllDoneButton>
          </Link>
        )}
        <BooksImage src={hover ? imageSrcHover[bookIndex] : imageSrc} alt="Main" />
        {hotspots.map((hotspot, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              clipPath: `polygon(${hotspot.points.join(', ')})`,
              cursor: 'pointer',
            }}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={() => handleMouseLeave(index)}
            onClick={() => handleModalOpen(index)}
          ></div>
        ))}
      </LibraryContainer>
      <Modal isOpen={modalIsOpen} onRequestClose={handleModalClose} style={modalStyle} ariaHideApp={false}>
        <Book bookIndex={bookIndex} />
      </Modal>
    </>
  );
};

const AllDoneButton = styled(Button)`
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 200px;
  padding: 6px 22px;
  background: linear-gradient(180deg, #504f4f 45.31%, #0c0b0b 100%);
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 12px;

  &:hover {
    color: ${({ theme }) => theme.palette.brandLight};
  }
`;

const LibraryContainer = styled.div`
  // display: flex;
`;

const BooksImage = styled(Image)`
  max-width: 100vw;
  max-height: 100vh;
  width: auto;
  height: auto;
  object-fit: contain;
`;

export default ImageMap;
