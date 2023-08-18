import { Button } from 'components/Button/Button';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import ProgressBar from './ProgressBar';
import { QuizAnswer, QuizQuestion } from './questions';
import Slide from './Slide';

type QuestionSlideProps = {
  prevButtonClickHandler: () => void;
  nextButtonClickHandler: () => void;
  answerHandler: (questionNumber: number, answer: QuizAnswer, selectedAnswerIndex: number) => void;
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  initialSelectedAnswer?: number;
};

const QuestionSlide = ({
  questionNumber,
  totalQuestions,
  prevButtonClickHandler,
  nextButtonClickHandler,
  answerHandler,
  question,
  initialSelectedAnswer,
}: QuestionSlideProps) => {
  const handleAnswer = (selectedAnswer: QuizAnswer, selectedAnswerIndex: number) => {
    setAnswerSelected(true);
    setAnswerNumber(selectedAnswerIndex + 1);
    answerHandler(questionNumber, selectedAnswer, selectedAnswerIndex + 1);
  };

  const [answerSelected, setAnswerSelected] = useState(false);
  const [answerNumber, setAnswerNumber] = useState(0);

  useEffect(() => {
    setAnswerSelected(false);
  }, [question]);

  useEffect(() => {
    if (initialSelectedAnswer) {
      setAnswerNumber(initialSelectedAnswer);
      setAnswerSelected(true);
    }
  }, []);

  return (
    <Slide headerText={`Question ${questionNumber} of ${totalQuestions}`}>
      <QuestionContainer>
        <QuestionText>{question.question}</QuestionText>
        <AnswerButtons>
          {question.answers.map((a, i) => (
            <AnswerButton key={`ans-${i}`} onClick={() => handleAnswer(a, i)} selected={answerNumber === i + 1}>
              {a.answer}
            </AnswerButton>
          ))}
        </AnswerButtons>
        <ProgressBar questionNumber={questionNumber} totalQuestions={totalQuestions} />
        <ControlsContainer>
          <ControlButton playClickSound onClick={prevButtonClickHandler}>Previous</ControlButton>
          <ControlButton playClickSound disabled={!answerSelected} onClick={nextButtonClickHandler}>
            Next
          </ControlButton>
        </ControlsContainer>
      </QuestionContainer>
    </Slide>
  );
};

const ControlButton = styled(Button)`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 6px 22px;
  background: linear-gradient(180deg, #504f4f 45.31%, #0c0b0b 100%);
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  width: 92px;
  height: 27px;
  font-size: 12px;
  color: #ffffff;
  margin: 10px;
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 12px;

  &:disabled {
    color: grey;
    border: 0;
  }
`;

// TODO: props for highlighted answer or not
type AnswerButtonProps = {
  selected: boolean;
};

const AnswerButton = styled.button<AnswerButtonProps>`
  text-align: left;
  cursor: pointer;
  width: 600px;
  height: 42px;
  background: linear-gradient(180deg, #504f4f 45.31%, #0c0b0b 100%);
  border: 1px solid #bd7b4f;
  border-radius: 5px;
  color: #ffffff;
  margin: 15px;
  font-size: 24px;
  text-decoration: ${(props) => (props.selected ? 'underline' : 'none')};

  &:hover {
    border: 1px solid;
    border-image-source: linear-gradient(0deg, #ffdec9, #ffdec9), linear-gradient(0deg, #d9a37d, #d9a37d);
  }
`;

const AnswerButtons = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 70px;
  margin-bottom: 70px;
`;

const QuestionText = styled.div`
  text-transform: uppercase;
  font-size: 22px;
  width: 500px;
`;

const ControlsContainer = styled.div`
  display: flex;
  flex-direction: row;
  margin-top: 20px;
`;

const QuestionContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 100px;
`;

export default QuestionSlide;
