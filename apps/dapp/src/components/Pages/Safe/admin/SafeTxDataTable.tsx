import { useState, useEffect, useRef, Fragment, MouseEvent } from 'react';
import { LoadingText } from 'components/Pages/Core/components/LoaderVault/commons/LoadingText';
import env from 'constants/env';
import styled from 'styled-components';
import { loading } from 'utils/loading-value';
import { Button } from 'components/Button/Button';
import {
  SafeStatus,
  SafeTransactionCategory,
  useSafeTransactions,
} from 'safe/safeContext';
import dropdownIcon from 'assets/icons/dropdown.svg?react';
import { Copy } from 'components/Copy/Copy';

export type SafeTableRow = {
  date: string;
  txHash?: string;
  safeTxHash: string;
  status: SafeStatus;
  confirmations: string;
  alreadySigned: boolean;
  type: string;
  isOwner: boolean;
  nonce: number;
  isExpanded: boolean;
  dataRaw: string | null | undefined;
  dataDecode: string;
  button: {
    label: string;
    disabled: boolean;
  };
  action: () => void;
};

type Props = {
  safeTxCategory: SafeTransactionCategory;
  tableHeaders: string[];
};

export const SafeTxsDataTable = (props: Props) => {
  const { safeTxCategory, tableHeaders } = props;
  const [safeTableRows, setSafeTableRows] = useState<Array<SafeTableRow>>([]);
  const safeTransactions = useSafeTransactions();
  const ref = useRef(null);

  useEffect(() => {
    async function loadDataSubset() {
      const dataSubset = await safeTransactions.tableRows(
        safeTxCategory,
        updateSafeTableRow
      );
      if (!dataSubset) return;
      setSafeTableRows(dataSubset);
    }
    loadDataSubset();
  }, [safeTransactions, safeTxCategory]);

  const updateSafeTableRow = (safeTxHash: string, newValue?: SafeTableRow) => {
    setSafeTableRows((prevState) => {
      const newState = prevState.map((prevStateSafeRow) => {
        if (safeTxHash === prevStateSafeRow.safeTxHash) {
          return { ...prevStateSafeRow, ...newValue };
        } else {
          return { ...prevStateSafeRow };
        }
      });
      return newState;
    });
  };

  return (
    <DataTable>
      <thead>
        <HeaderRow>
          {tableHeaders.map((h, i) => (
            <TableHeader key={h}>
              <InnerDataRow>
                <HeaderTitleContainer>{h}</HeaderTitleContainer>
              </InnerDataRow>
            </TableHeader>
          ))}
        </HeaderRow>
      </thead>
      <tbody>
        {safeTransactions.isLoading() ? (
          loadSkeletonRows(1, tableHeaders.length)
        ) : !safeTableRows || safeTableRows.length === 0 ? (
          <DataRow hasBorderBotton>
            <DataCell>No data available</DataCell>
          </DataRow>
        ) : (
          <>
            {safeTableRows.map((row) => {
              return (
                <Fragment key={JSON.stringify(row)}>
                  <DataRow
                    hasBorderBotton={!row.isExpanded}
                    ref={ref}
                    key={row.txHash}
                    cursorPointer
                    onClick={() => {
                      updateSafeTableRow(row.safeTxHash, {
                        ...row,
                        isExpanded: !row.isExpanded,
                      });
                    }}
                  >
                    <DataCell>
                      <Button
                        isSmall
                        style={{ width: '95px', zIndex: '5' }}
                        label={row.button.label}
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation(); // avoid parent component onClick
                          updateSafeTableRow(row.safeTxHash, {
                            ...row,
                            status: 'loading',
                          });
                          row.action();
                        }}
                        loading={row.status === 'loading'}
                        disabled={row.button.disabled}
                      />
                    </DataCell>
                    <DataCell>{row.nonce}</DataCell>
                    <DataCell>{row.status}</DataCell>
                    <DataCell>{row.type}</DataCell>
                    <DataCell>{row.confirmations}</DataCell>
                    <DataCell>
                      <FlexContainer>
                        {row.date}
                        {row.isExpanded ? <ArrowUp /> : <ArrowDown />}
                      </FlexContainer>
                    </DataCell>
                  </DataRow>
                  {row.isExpanded && (
                    <DataRow hasBorderBotton>
                      <DataCell colSpan={tableHeaders.length}>
                        {row.txHash && (
                          <ExpandedDataRow
                            label="Tx"
                            value={row.txHash}
                            externalLink={`${env.etherscan}/tx/${row.txHash}`}
                          />
                        )}
                        <ExpandedDataRow
                          label="SafeTx"
                          value={row.safeTxHash}
                        />
                        {row.dataRaw && (
                          <>
                            <ExpandedDataRow
                              label="DataDecode"
                              value={row.dataDecode}
                              sliceValue={false}
                            />
                            <ExpandedDataRow
                              label="DataRaw"
                              value={row.dataRaw}
                            />
                          </>
                        )}
                      </DataCell>
                    </DataRow>
                  )}
                </Fragment>
              );
            })}
          </>
        )}
      </tbody>
    </DataTable>
  );
};

const loadSkeletonRows = (
  skeletonRowsNo: number,
  skeletonColumnsNo: number
) => {
  return [...Array(skeletonRowsNo)].map((_, index) => (
    <DataRow hasBorderBotton key={index}>
      {[...Array(skeletonColumnsNo)].map(
        (
          _,
          i // Adds x no of loading cells, same as no of table headers
        ) => (
          <DataCell key={i}>
            <LoadingText value={loading()} />
          </DataCell>
        )
      )}
    </DataRow>
  ));
};

type ExpandedDataRowProps = {
  label: string;
  value: string;
  sliceValue?: boolean;
  externalLink?: string;
};

const ExpandedDataRow = ({
  label,
  value,
  externalLink,
  sliceValue = true,
}: ExpandedDataRowProps) => {
  const ExpandedContainer = styled.div`
    display: flex;
    flex-direction: row;
    padding: 0 10px 2px 10px;
    align-items: baseline;
    gap: 10px;
  `;
  const Label = styled.label`
    font-weight: bold;
    color: ${({ theme }) => theme.palette.brand};
  `;
  const Pre = styled.pre`
    font-size: smaller;
    margin: 0;
  `;
  return (
    <ExpandedContainer>
      <Copy value={value} />
      <Label>{label}:</Label>
      {externalLink ? (
        <LinkStyled
          style={{ fontSize: 'smaller' }}
          href={externalLink}
          target="_blank"
        >
          {value}
        </LinkStyled>
      ) : (
        <Pre>
          {value.length > 70 && sliceValue
            ? value?.slice(0, 65) + '...'
            : value}
        </Pre>
      )}
    </ExpandedContainer>
  );
};

const TableHeader = styled.th`
  vertical-align: top;
  text-align: left;
  padding-top: 0.5rem;
`;

const HeaderTitleContainer = styled.div`
  margin-right: 5px;
`;

const HeaderRow = styled.tr`
  white-space: nowrap;
`;

const InnerDataRow = styled.div`
  display: flex;
  height: 1.5rem;
  font-size: 12px;
`;

const DataTable = styled.table`
  border-collapse: collapse;
  width: 100%;
  color: ${({ theme }) => theme.palette.brand};
`;

const DataRow = styled.tr<{
  hasBorderBotton: boolean;
  cursorPointer?: boolean;
}>`
  overflow: hidden;
  white-space: nowrap;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  cursor: ${({ cursorPointer }) => (cursorPointer ? 'pointer' : 'unset')};
  ${({ hasBorderBotton, theme }) =>
    `border-bottom: 1px solid ${
      hasBorderBotton ? theme.palette.brand : theme.palette.dark
    };`}
`;

const DataCell = styled.td<{ isHidden?: boolean }>`
  position: relative;
  padding: 10px 10px 10px 0;
  ${({ isHidden }) => isHidden && 'display: none;'}
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const LinkStyled = styled.a`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.9rem;
  font-weight: 700;
  &:hover {
    color: ${({ theme }) => theme.palette.brandDark};
  }
`;

const FlexContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const ArrowDown = styled(dropdownIcon)`
  fill: ${({ theme }) => theme.palette.brand};
`;

const ArrowUp = styled(dropdownIcon)`
  fill: ${({ theme }) => theme.palette.brand};
  transform: rotate(180deg);
`;
