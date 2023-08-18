import { useEffect, useState } from 'react';
import CollectSlide from './CollectSlide';
import FinalSlide from './FinalSlide';
import FirstSlide from './FirstSlide';
import { QuizQuestion, pickQuestions, QuizAnswer } from './questions';
import QuestionSlide from './QuestionSlide';
import { useWallet } from 'providers/WalletProvider';
import { useAccount } from 'wagmi';
import ConnectWalletSlide from './ConnectWalletSlide';
import SuccessSlide from './SuccessSlide';

// TODO: Move to env?
const NUMBER_OF_QUESTIONS = 10;
const PASSING_SCORE = 0.7;

type QuizAnswerState = {
  [key: string]: {
    answer: QuizAnswer;
    selectedAnswerIndex: number;
  };
};

const EMPTY_QUIZ_ANSWER_STATE: QuizAnswerState = {};

const Quiz = () => {
  const { isConnected } = useWallet();
  const { address } = useAccount();

  const [questionNumber, setQuestionNumber] = useState(0);
  const [questions, setQuestions] = useState([] as QuizQuestion[]);
  const [passed, setPassed] = useState(false);
  const [complete, setComplete] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswerState>(EMPTY_QUIZ_ANSWER_STATE);
  const [showConnect, setShowConnect] = useState(false);

  useEffect(() => {
    if (address && isConnected) {
      setShowConnect(false);
      return;
    }
    setShowConnect(true);
  }, [address, isConnected]);

  useEffect(() => {
    setQuestions(pickQuestions(NUMBER_OF_QUESTIONS));
  }, []);

  const startQuizHandler = () => {
    setQuestionNumber(1);
  };

  const prevButtonHandler = () => {
    setQuestionNumber(questionNumber - 1);
  };

  const nextButtonHandler = () => {
    setQuestionNumber(questionNumber + 1);
  };

  const submitButtonHandler = () => {
    console.debug(`---> Submit button clicked, calculating score`);
    const correctAnswers = Object.values(answers).filter((answer) => answer.answer.correct === true);
    const score = correctAnswers.length / NUMBER_OF_QUESTIONS;

    console.debug(`---> User score: ${score}`);
    if (score >= PASSING_SCORE) {
      setPassed(true);
      setComplete(true);
    } else {
      setPassed(false);
      setComplete(true);
    }
  };

  const quizAnswerHandler = (questionNumber: number, answer: QuizAnswer, selectedAnswerIndex: number) => {
    setAnswers({
      ...answers,
      [questionNumber]: {
        answer,
        selectedAnswerIndex,
      },
    });
  };

  const tryAgainButtonClickHandler = () => {
    // Reset state to beginning of quiz
    setComplete(false);
    setQuestions(pickQuestions(NUMBER_OF_QUESTIONS));
    setQuestionNumber(0);
    setAnswers(EMPTY_QUIZ_ANSWER_STATE);
  };

  const onMintSuccess = () => {
    setMintSuccess(true);
  };

  useEffect(() => {
    setComplete(false);
  }, []);

  if (showConnect) {
    return <ConnectWalletSlide />;
  }

  if (mintSuccess) {
    return <SuccessSlide />;
  }

  return (
    <>
      {questionNumber === 0 && <FirstSlide startButtonClickHandler={startQuizHandler} />}
      {questionNumber > 0 && questionNumber <= NUMBER_OF_QUESTIONS && (
        <QuestionSlide
          key={`question${questionNumber}`}
          prevButtonClickHandler={prevButtonHandler}
          nextButtonClickHandler={nextButtonHandler}
          question={questions[questionNumber - 1]}
          questionNumber={questionNumber}
          totalQuestions={NUMBER_OF_QUESTIONS}
          answerHandler={quizAnswerHandler}
          initialSelectedAnswer={answers[questionNumber] && answers[questionNumber].selectedAnswerIndex}
        />
      )}
      {!complete && questionNumber > NUMBER_OF_QUESTIONS && (
        <FinalSlide backButtonClickHandler={prevButtonHandler} submitButtonClickHandler={submitButtonHandler} />
      )}
      {complete && <CollectSlide passed={passed} tryAgainButtonClickHandler={tryAgainButtonClickHandler} onSuccessCallback={onMintSuccess} />}
    </>
  );
};

export default Quiz;
