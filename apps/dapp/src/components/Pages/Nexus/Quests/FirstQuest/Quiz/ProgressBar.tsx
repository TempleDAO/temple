import styled from 'styled-components';

type QuestionSlideProps = {
  questionNumber: number;
  totalQuestions: number;
};

const ProgressBar = ({ questionNumber, totalQuestions }: QuestionSlideProps) => {
  const percentProgress = questionNumber / totalQuestions;
  console.log(percentProgress);
  return (
    <ParentContainer>
      <ProgressContainer>
        <ProgressIndicator percentProgress={percentProgress} />
      </ProgressContainer>
      <QuestionStatus>
        {questionNumber}/{totalQuestions}
      </QuestionStatus>
    </ParentContainer>
  );
};

const ParentContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 1000px;
  position: relative;
`;

const QuestionStatus = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 25px;
  font-size: 24px;
  line-height: 30px;
`;

const ProgressContainer = styled.div`
  box-sizing: border-box;
  width: 1000px;
  height: 10px;
  border: 1px solid #bd7b4f;
  border-radius: 20px;
`;

interface ProgressIndicatorProps {
  percentProgress: number;
}

const ProgressIndicator = styled.div<ProgressIndicatorProps>`
  width: ${props => (props.percentProgress * 1000)}px;
  height: 10px;
  background: #bd7b4f;
  border-radius: 20px;
`;

export default ProgressBar;
