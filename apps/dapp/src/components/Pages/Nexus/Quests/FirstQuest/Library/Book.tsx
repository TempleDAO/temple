import styled from 'styled-components';
import Image from 'components/Image/Image';

import book1 from 'assets/images/nexus/book1-onepage.png';
import book2 from 'assets/images/nexus/book2-onepage.png';
import book3 from 'assets/images/nexus/book3-onepage.png';
import book4 from 'assets/images/nexus/book4-onepage.png';
import book5 from 'assets/images/nexus/book5-onepage.png';
import book6 from 'assets/images/nexus/book6-onepage.png';

type BookProps = {
  bookIndex: number;
};

const BOOKS = [book1, book2, book3, book4, book5, book6];

const Book = ({ bookIndex }: BookProps) => {
  return (
    <BookContainer>
      <BookPicture src={BOOKS[bookIndex]} />
    </BookContainer>
  );
};

const BookPicture = styled(Image)`
  width: 1260;
  height: 834;
`;

const BookContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

export default Book;
