import userManualLogo from '../../../../assets/images/nexus/usermanual.png';
import shardsLogo from '../../../../assets/images/nexus/usermanualshards.png';
import { ContentContainer, ManualImage, Paragraph, Subtitle, Title, ManualContainer } from './styles';

const NexusUserManual = () => {
  return (
    <ManualContainer>
      <ContentContainer>
        <ManualImage src={userManualLogo} />
        <Title>What is Temple Nexus?</Title>
        <Paragraph>
          Temple Nexus is the Web 3.0 gateway into the world of Temple and its partner protocols. It allows users to
          chronicle their unique individual journey into the Arbitrum L2 Temple ecosystem. On their journey, the user
          will solve puzzles and complete quests to unlock new ranks and achievement badges in the form of ERC-1155 NFTs
          called Shards.
        </Paragraph>
        <Paragraph>
          Being a decorated user in Nexus grants access to rich experiences in the Templeverse, special privileges, and
          exclusive access to partner protocol whitelists or product launches. Designed to be modular and extensible,
          anyone can build atop Nexus with this new composable NFT primitive powered by TempleDAO. We hope that the
          Nexus will continue to evolve organically as an open-ended, bespoke, and rewarding experience for both
          Templars and Partners.
        </Paragraph>
        <Title>Relics</Title>
        <Paragraph>
          To begin their Nexus journey, the user will need to acquire a Relic, an ERC-721 NFT that acts as a passport to
          grant access to the Temple ecosystem. Like a travel passport, the Relic is central to a Templar’s identity.
          When the user mints their Relic, they will need to select an Enclave, which is akin to selecting a character
          class. There may be quests that are only available to the Enclave of Structure, for example.
        </Paragraph>
        <Paragraph>
          The Relic functions as a wallet to store Shards, which are reward or quest badges (ERC-1155 NFT). The type and
          quantity of Shards equipped in the Relic inventory determines the user ranking in the Templeverse and access
          to additional quests. Furthermore, Shards can be combined using Forge recipes to transmute them into Shards
          with higher rarity or different access. Relics can be bought or sold on the marketplace, adding a whole new
          level of utility.
        </Paragraph>
        <Subtitle>How to mint a Relic ?</Subtitle>
        <Paragraph>
          To mint a Relic, the user must sacrifice a small amount of TEMPLE on the Arbitrum chain. The Relic mint price
          starts at 10 TEMPLE and rises over the course of one year. The maximum mint price is capped at 50 TEMPLE. The
          TEMPLE tokens used for the Relic mint are burned forever. To pay for the mint, the user may bridge over TEMPLE
          from Ethereum using the official Aribitrum bridge. Alternatively, the user may acquire the native TEMPLE on
          Arbitrum from a WETH/TEMPLE Uniswap v3 pool provided for their convenience.
        </Paragraph>
        <ManualImage src={shardsLogo} />
        <Title>Shards</Title>
        <Paragraph>
          If Relics are like travel passports, then Shards are like the visa stamps. Upon successful completion of a
          quest, the user can mint a Shard NFT that can be transferred or equipped into their Relic. Both Temple
          internal projects and external partners can create Relic-compatible Shards with their own criteria for minting
          and token-gated use cases. The Nexus Shard Minting contract supports any number of ERC-1155 NFTs earmarked
          exclusively for the Shard collection.
        </Paragraph>
        <Paragraph>
          For instance, a retweeting task on Twitter may be the user requirement to be allowed to mint 1 of 100 Nexus
          Shards that are available through Nexus. The NFT may then be used to bestow whitelist access to a project’s
          upcoming mint, airdrop, bond offering, or simply grant an exclusive VIP role in the Discord server. More
          complex requirements such as solving a puzzle are also possible. The business logic behind the Shard mint is
          limited only by the imagination.
        </Paragraph>
        <Title>Transmutation</Title>
        <Paragraph>
          Some unique Shards are obtainable only through Transmutation. The Nexus dApp allows Relic holders to perform
          transmutations by clicking on the Forge Tab and transferring the Shards from their Relic inventory to the
          Transmutation Crucible. In effect, the user is utilizing Shards as recipe ingredients to forge other Shards
          that are more rare, grant different access, or reflect upgraded experience level. Transmutation also consumes
          Shards, making them more rare.
        </Paragraph>
        <Paragraph>
          Some transmutation recipes require multiple instances of the same Shard i.e. quantity {'>'} 1. Transmutation
          Recipes may be public or secret, depending on the Shard. New recipes can be added at any time.
        </Paragraph>
        <Paragraph>
          <a href="https://templedao.gitbook.io/temple-nexus/" target="_blank">
            Click Here
          </a>{' '}
          to gain deeper information about mechanics in our{' '}
          <a href="https://templedao.gitbook.io/temple-nexus/" target="_blank">
            Gitbook Guide
          </a>
          .
        </Paragraph>
      </ContentContainer>
    </ManualContainer>
  );
};

export default NexusUserManual;
