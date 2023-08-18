import styled from 'styled-components';
import partnerManualLogo from '../../../../assets/images/nexus/partnermanual.png';
import applyingLogo from '../../../../assets/images/nexus/partnermanualapplying.png';
import { CodeBlock, ContentContainer, ManualContainer, ManualImage, Paragraph, Title, ListContainer } from './styles';

const NexusPartnerManual = () => {
  return (
    <ManualContainer>
      <ContentContainer>
        <ManualImage src={partnerManualLogo} />
        <Title>Temple Nexus - Partner manual</Title>
        <Paragraph>
          The Temple Nexus is an NFT-based platform which tokenizes a user’s digital footprint within TempleDAO’s
          ecosystem on-chain.
        </Paragraph>
        <Paragraph>
          It employs gamification ideas to engage and reward users while improving the interoperability and
          composability between TempleDAO and external projects. Nexus opens up a new suite of tooling for our partners
          to create fun, sybil-resistant experiences as a means to token-gate protocol events for their user base. Build
          a stronger moat for your community through quests and incentivising good user behavior. It is very
          customizable and opens up all kinds of composable opportunities within the vibrant Arbitrum L2 ecosystem.
        </Paragraph>
        <ManualImage src={applyingLogo} />
        <Title>Become a Partner</Title>
        <Paragraph>
          Becoming a partner is easy. Doing so will give you the rights to allow minting of “Shards” which are NFTs
          (ERC-1155) that users can collect via Nexus. The logic behind how the user gets the Shard is entirely up to
          you. It can be as easy as going to your dApp to mint it or as challenging as making users go through a series
          of tests and puzzles before they can mint one.
        </Paragraph>
        <Paragraph>Just submit the following information to apply for your Nexus Shard:</Paragraph>
        <ListContainer>
          <ul>
            <li>
              A contract address which implements the minting logic and calls the partnerMint function on Shards.sol to
              deliver the Shard for the user
            </li>
            <li>A corresponding URI for the Shard’s visual metadata</li>
            <li>
              The total supply (applicable only if you are planning to enforce a maximum supply cap, otherwise, infinite
              supply Shards are allowed)
            </li>
            <li>
              A short descriptive text about the Shard’s lore to be displayed on the Quest card in the Quest tab of the
              Nexus dApp (x characters maximum)
            </li>
            <li>
              An image to be displayed on the Quest card in the Quest tab of the Nexus dApp (.png or .svg file format no
              more than 1.5mb in size)
            </li>
          </ul>
        </ListContainer>
        <Paragraph>
          In exchange you will be given a specific tokenId to be minted by your allowlisted contract address, using the
          following function:
        </Paragraph>
        <CodeBlock>
          <pre>
            {`
function partnerMint(
    address _to,
    uint256 _id,
    uint256 _amount,
    bytes memory data
    ) external {
    require(partnerMinters[msg.sender], "You're not authorised to mint");
    require(partnerAllowedIds[msg.sender][_id], "This isn't your reserved itemId");
    _mint(_to, _id, _amount, data);
    emit MintedShard(_to, _id, _amount);
}
        `}
          </pre>
        </CodeBlock>
        <Paragraph>Click "Insert Link" to gain deeper information about mechanics in our Gitbook Guide.</Paragraph>
      </ContentContainer>
    </ManualContainer>
  );
};

export default NexusPartnerManual;
