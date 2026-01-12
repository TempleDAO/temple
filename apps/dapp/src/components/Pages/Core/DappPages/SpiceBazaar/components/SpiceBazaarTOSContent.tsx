// src/components/Pages/Core/DappPages/SpiceBazaar/components/SpiceBazaarTOSContent.tsx

import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';

export const SpiceBazaarTOSContent = () => {
  return (
    <>
      <Heading>TERMS OF SERVICE</Heading>
      <Paragraph
        style={{ fontSize: '12px', fontStyle: 'italic', marginBottom: '24px' }}
      >
        Last Updated: January 11, 2025
      </Paragraph>

      <Paragraph>
        <Strong>IMPORTANT NOTICE</Strong>
      </Paragraph>

      <Paragraph>
        These Terms include (i) broad disclaimers; (ii) limitations of
        liability; (iii) an indemnity; (iv) an assumption of risk and release;
        and (v) dispute resolution provisions including arbitration and a class
        action waiver (to the fullest extent permitted by Applicable Law).{' '}
        <Strong>Do not access or use the Services if you do not agree</Strong>.
      </Paragraph>

      <Paragraph>
        <Strong>1. Parties; Acceptance; Scope; Updates</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>1.1 Who we are</Strong>. The Services are made available by
        Temple Foundation, an exempted foundation company incorporated in the
        Cayman Islands (the &quot;<Strong>Operator</Strong>&quot;). References
        to &quot;Spice Bazaar&quot;, &quot;we&quot;, &quot;us&quot; or
        &quot;our&quot; mean the Operator (and not the TempleDAO community, any
        token holders, or any other Person).
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>1.2 Agreement</Strong>. By accessing or using the Services
        (including by connecting a Wallet, clicking &quot;I agree&quot;, signing
        a message, or otherwise interacting with any part of the Services), you
        agree to be legally bound by these Terms and acknowledge you have read
        and understood the risk disclosures and disclaimers in these Terms.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>1.3 Scope</Strong>. These Terms govern your access to and use of
        the Website and all related interfaces, tools, features, content, and
        services made available through Spice Bazaar, including (without
        limitation) any auction interfaces, token claim interfaces, and any
        links or integrations to smart contracts or Third-Party Platforms
        (collectively, the &quot;<Strong>Services</Strong>&quot;).
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>1.4 Updates</Strong>. We may amend these Terms at any time under
        Section 22. The Terms in effect at the time of your use apply to that
        use. If you continue using the Services after updated Terms are posted,
        you accept the updated Terms.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>1.5 Additional terms; priority</Strong>. The Services (and
        specific features such as auctions) may be subject to additional terms,
        rules, eligibility criteria, and disclosures displayed in the Services,
        in associated documentation, or in any &quot;Legal Notice&quot; /
        &quot;Risk Disclosure&quot; published by the Operator (together, the
        &quot;Additional Terms&quot;). The Additional Terms form part of these
        Terms. If there is any conflict, the following order of priority applies
        (to the extent of the conflict only): (a) the Additional Terms for the
        relevant feature/transaction; then (b) these Terms; then (c) any other
        materials.
      </Paragraph>

      <Paragraph>
        <Strong>
          2. Eligibility; Restricted Persons; No Circumvention; Repeating
          Representations
        </Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>2.1 Age and capacity</Strong>. You must be at least 18 years old
        (or the age of majority in your jurisdiction, if higher) and have full
        capacity and authority to enter into these Terms.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>2.2 Restricted Persons; Restricted Jurisdictions</Strong>. You
        must not access or use the Services if you are a Restricted Person or
        located in, resident in, organised under the laws of, or acting on
        behalf of any Person in a Restricted Jurisdiction.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>2.3 Sanctions; AML/CTF</Strong>. You must not access or use the
        Services if you are a Sanctioned Person or otherwise subject to
        Sanctions. You represent and warrant that your use of the Services does
        not violate Applicable Law (including sanctions, AML/CTF, export
        controls, and anti-corruption laws).
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>2.4 No circumvention</Strong>. You must not use any VPN, proxy,
        geolocation spoofing, or similar technology to conceal your location or
        circumvent restrictions, screening, or controls.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>2.5 Repeating representations</Strong>. Each time you access or
        use the Services, you repeat the representations and warranties in this
        Section 2 and Section 11. You must immediately cease use if any
        representation becomes untrue.
      </Paragraph>

      <Paragraph>
        <Strong>
          3. Nature of the Services; Protocol Autonomy; No Intermediation; No
          Custody
        </Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>3.1 Interface only</Strong>. The Services provide a software
        interface that may enable you to view information and interact directly
        with Smart Contracts and/or Third-Party Platforms. The Services are not
        a financial product, exchange, market, broker service, custody service,
        settlement service, or payment service.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>3.2 No brokerage; no agency; no fiduciary</Strong>. The Operator
        does not act as a broker, dealer, arranger, introducer, agent,
        fiduciary, custodian, trustee, escrow agent, settlement agent,
        investment adviser, commodity trading adviser, financial adviser,
        portfolio manager, or money transmitter, and does not owe any duties of
        suitability, best execution, chaperoning, monitoring, or supervision.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>3.3 Non-custodial</Strong>. Where Wallet connection is
        supported, it is non-custodial. We do not control private keys and
        cannot access, recover, reset, or transfer Digital Assets in your
        Wallet.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>3.4 Protocol autonomy; no control</Strong>. Smart Contracts
        (including any auction contracts and any token contracts) operate
        automatically according to their code and the relevant blockchain
        network rules. You acknowledge that on-chain actions may be irreversible
        and executed without human intervention, and you accept the risk of
        interacting with Smart Contracts.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>3.5 No privity; no direct claims; limited recourse</Strong>.
        Accessing or using the Services does not create, and shall not be
        construed as creating, any custodial, agency, fiduciary, trust,
        bailment, deposit, brokerage, advisory, partnership, joint venture, or
        similar relationship between you and any Relevant Party. Any rights you
        may have in relation to an on-chain interaction are limited to your own
        Wallet and the assets (if any) held by the specific Smart Contract with
        which you interacted, and you waive any recourse to the Relevant Parties
        to the fullest extent permitted by Applicable Law. To the fullest extent
        permitted by Applicable Law, you agree that you have no claim against
        any Relevant Party in respect of any loss arising from Smart Contract
        operation, auction mechanics, parameter changes, or Treasury deployment
        decisions except to the extent such loss is directly caused by that
        Relevant Party&apos;s fraud or wilful misconduct.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>3.6 Third-Party transactions</Strong>. Unless we expressly state
        otherwise in writing for a particular off-chain transaction, the
        Operator is not a party to any agreement or transaction between Users or
        between a User and any Third Party. Any such dealings are at your own
        risk.
      </Paragraph>

      <Paragraph>
        <Strong>4. TGLD and Auctions</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.1 Overview</Strong>. If enabled, the Services may include:
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        1) <Strong>Temple Gold (TGLD)</Strong> – a non-transferable utility
        token with no cash value;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        2) <Strong>Temple Gold Auctions</Strong> – periodic USDS-for-TGLD
        auctions; and
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        3) <Strong>Spice Auctions</Strong> – TGLD-for-volatile-token auctions.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.2 TGLD characteristics</Strong>. TGLD is intended to be a
        non-transferable ERC-20-style utility token, potentially bridgeable only
        to the same address across chains (if supported). TGLD has no monetary
        value, no governance rights, and no claim on any Treasury assets or any
        assets of any Person. Holding TGLD does not create any right to receive
        cash, yield, interest, profit, or repayment from the Operator or any
        other Person.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.3 Emissions; changes; no compensation</Strong>. TGLD may be
        minted algorithmically (for example, every two weeks) and allocated by
        Smart Contract to addresses or contracts (for example, a TGLD auction
        contract, a staking contract, and a Treasury/operations wallet) in
        proportions that may be amended from time to time. You acknowledge that
        emissions are not compensation, yield, or interest, and may change or
        stop entirely.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.4 Auctions</Strong>. Auctions are executed via Smart
        Contracts. Auction parameters, timing, rules, eligibility requirements,
        and settlement mechanics may be displayed via the Services or in
        accompanying documentation, and form part of these Terms. Bids are final
        once submitted on-chain, and are generally not cancellable or
        reversible.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.5 TGLD Auctions</Strong>. If enabled, you may bid USDS (or
        such other designated Digital Asset) for newly minted TGLD in periodic
        auctions. Allocation mechanics (including any pro-rata allocation) are
        determined by Smart Contract code and the published auction rules.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.6 Spice Auctions</Strong>. If enabled, holders may bid TGLD to
        receive designated volatile Treasury tokens made available in a specific
        auction. Allocation may be pro-rata based on valid bids at close, as
        determined by Smart Contract logic and auction rules.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.7 Pause/cancel/modify</Strong>. To the fullest extent
        permitted by Applicable Law, the Operator may pause, suspend, cancel, or
        decline to implement any auction or module (in whole or part) for legal,
        compliance, sanctions, technical, security, risk-management, or
        operational reasons (including where required to comply with Applicable
        Law or a Governmental Authority). Where an auction is paused or
        cancelled, outcomes (including refunds, rollovers, or other handling)
        are determined solely by the relevant Smart Contract logic and/or the
        published auction rules, and may result in loss.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.8 Treasury proceeds; no segregation; execution-only</Strong>.
        If the Services describe that auction proceeds are used for Treasury
        strategies, you acknowledge:
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        1) any proceeds (including USDS) may be deployed into Treasury
        strategies on an execution-only basis;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        2) funds are not segregated for your benefit and form part of broader
        Treasury assets; and
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        3) the Operator does not owe any duty to monitor, optimise, or manage
        any Treasury strategy for you, and makes no promises as to performance
        or outcome.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.9 No expectation; no reliance</Strong>. You acknowledge you
        have no expectation of profit, repayment, yield, or value from TGLD or
        auction participation, and you do not rely on any statement not
        expressly set out in these Terms and the published auction rules.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>4.10 No refunds; no reversals</Strong>. To the fullest extent
        permitted by Applicable Law, all bids, participation, and on-chain
        actions are final, and the Operator does not provide refunds, credits,
        or reversals (including in relation to failed transactions, user error,
        blockchain congestion, or Smart Contract behaviour), except as expressly
        implemented by the relevant Smart Contract logic or expressly stated in
        the published auction rules for the relevant auction.
      </Paragraph>

      <Paragraph>
        <Strong>5. Accounts; Wallets; Security</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>5.1 Account</Strong>. We may require you to create an account.
        You must provide accurate information and keep it up to date.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>5.2 Security</Strong>. You are solely responsible for
        safeguarding your login credentials, devices, Wallet, private keys, seed
        phrase, and all activity conducted through them.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>5.3 Unauthorised Use</Strong>. You must notify us promptly of
        any suspected unauthorised access. We have no responsibility for losses
        caused by compromised credentials, Wallets, keys, SIM-swaps, phishing,
        malware, or device compromise.
      </Paragraph>

      <Paragraph>
        <Strong>6. Fees; Taxes; Finality</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>6.1 Fees</Strong>. We may charge fees as disclosed via the
        Services. Fees may change at any time to the extent permitted by
        Applicable Law. Unless expressly displayed in the Services for a
        particular feature or transaction, the Operator does not charge any fees
        for use of the Services.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>6.2 Network and Third-Party Fees</Strong>. Your use may involve
        third-party fees (including gas/network fees and platform fees). We do
        not control and are not responsible for them.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>6.3 Taxes</Strong>. You are solely responsible for all taxes,
        duties, levies, and reporting obligations arising from your use of the
        Services or any transaction.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>6.4 Finality</Strong>. Transactions (including on-chain
        transactions) are generally irreversible. You are solely responsible for
        verifying transaction details prior to submission.
      </Paragraph>

      <Paragraph>
        <Strong>7. Acceptable Use; Prohibited Conduct</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        You must not (and must not attempt to):
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        1) violate Applicable Law, including sanctions, AML/CTF, export
        controls, or anti-corruption laws;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        2) access or use the Services if you are ineligible under Section 2;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        3) use the Services to facilitate fraud, deception, market manipulation,
        or unlawful activity;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        4) interfere with or disrupt the Services (including scraping, abusive
        automation, or denial-of-service);
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        5) circumvent access controls, security measures, geofencing, or
        screening;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        6) impersonate others or misrepresent affiliation;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        7) introduce malware or harmful code;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        8) infringe IP or privacy rights;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        9) use bots/scripts to obtain unfair advantage (including in
        drops/auctions);
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        10) reverse engineer, decompile, or attempt to derive source code
        (except to the extent prohibited by Applicable Law); or
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        11) use the Services for competitive analysis or to build competing
        products.
      </Paragraph>

      <Paragraph>
        <Strong>
          8. Compliance; Screening; Information; Refusal; Reporting
        </Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>8.1 Controls</Strong>. We may implement screening, geolocation
        checks, Wallet screening, and other controls.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>8.2 Information Requests</Strong>. We may request information
        and documentation to satisfy compliance or risk requirements. Failure to
        provide requested information may result in refusal, suspension, or
        termination of access.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>8.3 Refusal/Suspension/Termination</Strong>. We may refuse,
        restrict, suspend, or terminate access (including disabling accounts or
        blocking interface functionality) at any time where we reasonably
        consider it necessary to:
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        1) comply with Applicable Law or a Governmental Authority request;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        2) respond to legal or regulatory risk;
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        3) protect the Services, Users, or Third Parties; or
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        4) enforce these Terms.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>8.4 Cooperation</Strong>. You acknowledge we may cooperate with
        Governmental Authorities and provide information (including personal
        data) as required or permitted under Applicable Law and the Privacy
        Policy.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>8.5 No obligation to permit access</Strong>. The Operator has no
        obligation to permit any Person to access or use the Services, and may
        block, refuse, or limit access at any time in its discretion (including
        where it is unable to complete screening to its satisfaction), to the
        fullest extent permitted by Applicable Law.
      </Paragraph>

      <Paragraph>
        <Strong>9. Third-Party Platforms; Third-Party Content</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>9.1 Third-Party Platforms</Strong>. The Services may integrate
        with or link to Third-Party Platforms (wallets, marketplaces, payment
        processors, protocols, social platforms). We do not control them and are
        not responsible for their acts, omissions, security, availability, or
        terms.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>9.2 Third-Party Content</Strong>. Any third-party content is
        provided &quot;as is&quot; without endorsement.
      </Paragraph>

      <Paragraph>
        <Strong>10. Intellectual Property; Limited Licence</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>10.1 Our IP</Strong>. The Services and all associated
        Intellectual Property Rights are owned by or licensed to the Operator
        and/or its licensors.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>10.2 Limited Licence</Strong>. We grant you a limited,
        revocable, non-exclusive, non-transferable licence to access and use the
        Services solely as permitted by these Terms.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>10.3 Restrictions</Strong>. You must not copy, modify,
        distribute, sell, lease, &quot;frame&quot;, mirror, scrape, or create
        derivative works of the Services except as permitted by Applicable Law.
      </Paragraph>

      <Paragraph>
        <Strong>11. Representations and Warranties</Strong>
      </Paragraph>

      <Paragraph>
        You represent, warrant and covenant (repeating on each access/use) that:
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        1) you satisfy Section 2 and are an Eligible User (if applicable);
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        2) you are not a Restricted Person and are not in a Restricted
        Jurisdiction;
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        3) your Digital Assets are legally obtained and not derived from
        unlawful activity;
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        4) you will comply with Applicable Law;
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        5) you understand and accept the risks in Schedule 1; and
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        6) you have not relied on any statement or representation not expressly
        set out in these Terms and the published auction rules.
      </Paragraph>

      <Paragraph>
        <Strong>12. No Advice; No Reliance; No Offering</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>12.1 No advice</Strong>. We do not provide legal, tax,
        investment, accounting, or other advice. You must obtain independent
        professional advice as needed.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>12.2 No reliance</Strong>. You acknowledge you do not rely on
        any statement or representation not expressly set out in these Terms (or
        the specific published auction rules) when using the Services.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>12.3 No offering; no securities registration</Strong>. Nothing
        in the Services constitutes an offer, solicitation, recommendation, or
        advice to buy, sell, or hold any asset, and no action is being taken to
        permit a public offering of any token or participation right in any
        jurisdiction where such action would be required. TGLD is intended to be
        a non-transferable utility token with no cash value and no claim on
        assets.
      </Paragraph>

      <Paragraph>
        <Strong>13. Disclaimers (As Is; As Available)</Strong>
      </Paragraph>

      <Paragraph>
        To the maximum extent permitted by Applicable Law, the Services (and any
        content, tools, integrations, and Third-Party Platforms) are provided
        &quot;as is&quot; and &quot;as available&quot;, without warranties of
        any kind, whether express, implied, statutory, or otherwise, including
        warranties of merchantability, fitness for a particular purpose,
        non-infringement, title, accuracy, availability, security, or that the
        Services will be uninterrupted or error-free.
      </Paragraph>

      <Paragraph>
        <Strong>14. Assumption Of Risk; Release</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>14.1 Assumption of risk</Strong>. You voluntarily assume all
        risks arising from your use of the Services, including on-chain
        activity, Smart Contract risk, auction risk, allocation risk, volatility
        risk, Wallet/key loss risk, regulatory risk, and tax risk.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>14.2 Release and waiver</Strong>. To the fullest extent
        permitted by Applicable Law, you release each Relevant Party from any
        and all claims and causes of action arising out of or relating to: (a)
        Third-Party Platforms; (b) your transactions with Smart Contracts or
        Third Parties; (c) blockchain/network incidents; (d) any auction outcome
        or allocation; and (e) unauthorised access to or loss of your
        Wallet/keys.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>14.3 No class/collective actions (substantive waiver)</Strong>.
        To the fullest extent permitted by Applicable Law, you agree not to
        commence, support, or participate in any class, collective,
        representative, or derivative action against any Relevant Party arising
        out of or relating to the Services.
      </Paragraph>

      <Paragraph>
        <Strong>15. Limitation Of Liability</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>15.1 Excluded Damages</Strong>. To the fullest extent permitted
        by Applicable Law, no Relevant Party will be liable for any indirect,
        incidental, special, consequential, exemplary, or punitive damages, or
        any loss of profits, revenue, goodwill, data, business opportunities, or
        substitute services, arising out of or relating to the Services or these
        Terms, however caused and under any theory of liability.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>15.2 Liability Cap</Strong>. To the fullest extent permitted by
        Applicable Law, the aggregate liability of the Relevant Parties for all
        claims arising out of or relating to the Services or these Terms will
        not exceed the greater of:
      </Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>1) US$100, and</Paragraph>

      <Paragraph style={{ marginLeft: '40px' }}>
        2) the total fees paid by you to the Operator for the Services in the
        three (3) months immediately preceding the event giving rise to the
        claim.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>15.3 Essential Basis</Strong>. You agree these limitations are
        an essential basis of the bargain and apply even if a remedy fails of
        its essential purpose.
      </Paragraph>

      <Paragraph>
        <Strong>16. Indemnity</Strong>
      </Paragraph>

      <Paragraph>
        You will defend, indemnify, and hold harmless each Relevant Party from
        and against any claims, liabilities, damages, losses, and expenses
        (including reasonable legal fees) arising out of or relating to:
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        1) your access to or use of the Services;
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        2) your breach of these Terms;
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        3) your User Content;
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        4) your violation of Applicable Law; or
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        5) your dealings with any Third Party.
      </Paragraph>

      <Paragraph>
        <Strong>17. Termination; Survival</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>17.1 Termination by You</Strong>. You may stop using the
        Services at any time.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>17.2 Termination by Us</Strong>. We may suspend or terminate
        your access at any time for any reason (including compliance, risk, or
        enforcement), to the extent permitted by Applicable Law.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>17.3 Survival</Strong>. Sections 1.1, 1.5, 2, 3, 4.10, 6, 8,
        10–16, 17.3–17.4, 18–22, and the Schedules (and any provisions that by
        their nature should survive) survive termination.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>17.4 On-chain state unaffected</Strong>. Suspension or
        termination of access to the Services does not affect the operation of
        any blockchain network or Smart Contract, and does not reverse or unwind
        any on-chain transaction. The Operator has no ability to reverse,
        cancel, or undo on-chain actions.
      </Paragraph>

      <Paragraph>
        <Strong>18. Disputes; Arbitration / Courts; Class Action Waiver</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>18.1 Good Faith</Strong>. The parties will attempt in good faith
        to resolve disputes informally.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>18.2 Governing Law</Strong>. These Terms and any non-contractual
        obligations are governed by the laws of Cayman Islands, excluding
        conflict of law rules.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>18.3 Arbitration.</Strong> Except for injunctive or equitable
        relief under Section 18.4, any dispute, claim or controversy arising out
        of or relating to these Terms or the Services (including any question
        regarding their existence, validity or termination) shall be finally
        resolved by arbitration under the UNCITRAL Arbitration Rules. The seat
        (legal place) of arbitration shall be the Cayman Islands. The language
        shall be English. The tribunal shall consist of one (1) arbitrator. The
        arbitrator shall be appointed by agreement of the parties; failing
        agreement within 30 days of a written notice of arbitration, the
        arbitrator shall be appointed, at the request of any party, by the
        appointing authority being the LCIA Court (or, if it is unwilling or
        unable to act, such other appointing authority as the parties agree or
        as a court of competent jurisdiction appoints). Judgment on the award
        may be entered in any court of competent jurisdiction.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>18.4 Injunctive Relief</Strong>. The Operator may seek
        injunctive or equitable relief in any competent court to protect its
        Intellectual Property Rights, confidential information, or to prevent
        misuse/security incidents.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>18.5 Class Action Waiver</Strong>. To the fullest extent
        permitted by Applicable Law, you agree disputes will be brought only on
        an individual basis and not as a plaintiff or class member in any
        class/collective/representative action.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>18.6 Jury Waiver (If Court Proceedings Apply)</Strong>. To the
        fullest extent permitted by Applicable Law, the parties waive trial by
        jury.
      </Paragraph>

      <Paragraph>
        <Strong>19. Force Majeure</Strong>
      </Paragraph>

      <Paragraph>
        No Relevant Party is liable for any failure or delay caused by a Force
        Majeure Event.
      </Paragraph>

      <Paragraph>
        <Strong>20. Changes to Services</Strong>
      </Paragraph>

      <Paragraph>
        We may modify, suspend, or discontinue any part of the Services at any
        time without liability, to the fullest extent permitted by Applicable
        Law.
      </Paragraph>

      <Paragraph>
        <Strong>21. Notices; Electronic Records; Signatures</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>21.1 Electronic Communications</Strong>. You consent to
        receiving notices and communications electronically (including via the
        Website, email, or in-product messages).
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>21.2 Clickwrap</Strong>. You agree that clicking &quot;I
        agree&quot; (or equivalent) constitutes your electronic signature and
        acceptance of these Terms.
      </Paragraph>

      <Paragraph>
        <Strong>22. General</Strong>
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>22.1 Severability</Strong>. If any provision is invalid or
        unenforceable, it will be modified to the minimum extent necessary, and
        the remainder remains in effect.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>22.2 Assignment</Strong>. You may not assign these Terms. We may
        assign these Terms to an affiliate or successor.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>22.3 No Waiver</Strong>. No waiver is effective unless in
        writing.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>22.4 Entire Agreement</Strong>. These Terms and the{' '}
        <ExternalLink
          href="https://docs.google.com/document/d/1l-obh1JejyimcIb4ud63wyOHyw9a3cILTlVppHwZqtM/edit?tab=t.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </ExternalLink>{' '}
        are the entire agreement regarding the Services.
      </Paragraph>

      <Paragraph style={{ marginLeft: '20px' }}>
        <Strong>22.5 No Third-Party Beneficiaries</Strong>. Except as expressly
        stated, these Terms confer no rights on third parties.
      </Paragraph>

      <Paragraph>
        <Strong>23. Contact</Strong>
      </Paragraph>

      <Paragraph>Temple Foundation</Paragraph>

      <Paragraph>Email: templedao@protonmail.com</Paragraph>

      <Paragraph>
        Registered Address:
        <br />
        c/o INTERNATIONAL CORPORATION SERVICES LTD
        <br />
        Harbour Place, 2nd Floor, North Wing
        <br />
        103 South Church Street
        <br />
        P.O. Box 472
        <br />
        George Town
        <br />
        Grand Cayman KY1-1106
        <br />
        Cayman Islands
      </Paragraph>

      <Paragraph>
        <Strong>SCHEDULE 1 – RISK FACTORS</Strong>
      </Paragraph>

      <Paragraph>
        Using the Services involves substantial risk. You should not use the
        Services unless you understand and can bear these risks.
      </Paragraph>

      <Paragraph>
        <Strong>1. TGLD has no cash value; non-transferable</Strong>. TGLD is
        intended to be non-transferable and has no monetary value, no governance
        rights, and no claim on any Treasury assets or any assets of any Person.
        You may be unable to sell, transfer, or realise any value from TGLD.
      </Paragraph>

      <Paragraph>
        <Strong>2. Auction finality; allocation risk</Strong>. Bids are final
        once submitted on-chain and are generally not cancellable or reversible.
        Auctions may result in partial allocation or no allocation. Allocation
        outcomes are determined solely by Smart Contract logic, the relevant
        blockchain network rules, and the published auction rules.
      </Paragraph>

      <Paragraph>
        <Strong>3. Pause/cancel/parameter change risk</Strong>. The Operator may
        pause, cancel, modify, suspend, or decline to implement any auction or
        module (in whole or in part) for legal, compliance, sanctions,
        technical, security, risk-management, or operational reasons. This may
        result in delay, loss, or outcomes you did not expect.
      </Paragraph>

      <Paragraph>
        <Strong>4. Treasury deployment; no segregation</Strong>. Auction
        proceeds may be deployed in Treasury strategies on an execution-only
        basis. Funds are not segregated for your benefit, may be exposed to loss
        or underperformance, and may be affected by market and smart contract
        risks.
      </Paragraph>

      <Paragraph>
        <Strong>5. Volatile token risk</Strong>. Tokens made available in Spice
        Auctions may be highly volatile, illiquid, or subject to rapid price
        changes and could lose significant value (including to zero).
      </Paragraph>

      <Paragraph>
        <Strong>6. Technology and Availability Risk</Strong>. The Services may
        be unavailable, interrupted, delayed, or contain errors. Maintenance,
        outages, or cyber incidents may prevent access.
      </Paragraph>

      <Paragraph>
        <Strong>7. Wallet and Key Risk</Strong>. If you lose control of your
        Wallet, private keys, seed phrase, or signing device, you may
        permanently lose access to your Digital Assets. Spice Bazaar cannot
        recover keys.
      </Paragraph>

      <Paragraph>
        <Strong>8. Blockchain Finality and Address Risk</Strong>. Transactions
        may be irreversible. Sending assets to the wrong address or wrong
        network may result in permanent loss.
      </Paragraph>

      <Paragraph>
        <Strong>9. Smart Contract / Protocol Risk</Strong>. If you interact with
        smart contracts or protocols via the Services, they may contain
        vulnerabilities, bugs, or design flaws. Exploits may result in partial
        or total loss.
      </Paragraph>

      <Paragraph>
        <Strong>10. Third-Party Platform Risk</Strong>. Wallet providers,
        marketplaces, payment processors, hosting providers, analytics
        providers, and other Third-Party Platforms may fail, be hacked,
        misbehave, or change terms. Spice Bazaar is not responsible for them.
      </Paragraph>

      <Paragraph>
        <Strong>11. Fraud, Scams, and Phishing</Strong>. Attackers may
        impersonate Spice Bazaar or other Users, trick you into signing
        malicious transactions, or steal credentials. You are responsible for
        verifying authenticity.
      </Paragraph>

      <Paragraph>
        <Strong>12. Market and Volatility Risk</Strong>. Digital Assets and
        related markets can be highly volatile. Prices, liquidity, and market
        depth may change rapidly and unpredictably.
      </Paragraph>

      <Paragraph>
        <Strong>13. Liquidity Risk</Strong>. Some Digital Assets may have
        limited liquidity or transferability, and you may be unable to sell,
        exit, transfer, or realise value.
      </Paragraph>

      <Paragraph>
        <Strong>14. Regulatory and Legal Risk</Strong>. Laws, regulations,
        guidance, or enforcement approaches may change. The Services may become
        restricted, require additional compliance measures, or become
        unavailable in certain jurisdictions. Regulatory action may adversely
        affect your ability to use the Services or transact.
      </Paragraph>

      <Paragraph>
        <Strong>15. Tax Risk</Strong>. The tax treatment of Digital Assets and
        related transactions is uncertain and may change. You are solely
        responsible for determining and meeting tax obligations, filing, and
        reporting.
      </Paragraph>

      <Paragraph>
        <Strong>16. Data and Privacy Risk</Strong>. Online services involve
        processing data and may be subject to security incidents. While we take
        reasonable measures, no system is perfectly secure.
      </Paragraph>

      <Paragraph>
        <Strong>17. Forks, Upgrades, and Network Changes</Strong>. Blockchains
        may fork or undergo upgrades. Assets may be affected or become
        incompatible. We may not support all networks, forks, or versions.
      </Paragraph>

      <Paragraph>
        <Strong>18. No Guaranteed Outcomes</Strong>. Participation in drops,
        auctions, promotions, or other features does not guarantee allocation,
        delivery, value, or profitability.
      </Paragraph>

      <Paragraph>
        <Strong>19. Force Majeure Risk</Strong>. Events outside our control
        (including natural disasters, war, terrorism, civil disorder, labour
        actions, major outages, or material cyber incidents) may impair or
        prevent the Services.
      </Paragraph>

      <Paragraph>
        <Strong>20. Unanticipated Risks</Strong>. Digital asset systems are
        evolving. There may be risks we cannot predict, including new attack
        vectors or regulatory developments.
      </Paragraph>

      <Paragraph>
        <Strong>SCHEDULE 2 – DEFINITIONS AND CONSTRUCTION</Strong>
      </Paragraph>

      <Paragraph>Capitalised Terms are defined as follows:</Paragraph>

      <Paragraph>
        &quot;<Strong>Additional Terms</Strong>&quot; has the meaning given in
        Section 1.5.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Affiliate</Strong>&quot; means, in relation to a Person,
        any other Person that directly or indirectly Controls, is Controlled by,
        or is under common Control with that Person.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Applicable Law</Strong>&quot; means any applicable
        statute, law, regulation, rule, directive, ordinance, code, guidance, or
        requirement of a Governmental Authority.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Control</Strong>&quot; means the power to direct the
        management and policies of an entity, directly or indirectly, whether
        through ownership of voting securities, by contract, or otherwise.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Eligible User</Strong>&quot; means a User who satisfies
        the requirements in Section 2 and is not a Restricted Person, is not in
        a Restricted Jurisdiction, and is otherwise eligible to access and use
        the Services under these Terms and any Additional Terms.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Digital Asset</Strong>&quot; means any cryptographic
        token, cryptocurrency, stablecoin, virtual asset, or other digital
        representation of value, including any associated network/protocol
        rights, forks, airdrops, or successor assets.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Force Majeure Event</Strong>&quot; means any event beyond
        a party&apos;s reasonable control, including extreme weather, natural
        disasters, war, terrorism, civil disorder, labour disputes,
        epidemics/pandemics, explosions, contamination, Governmental Authority
        actions, major utility/network failures, and material cyber incidents.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Governmental Authority</Strong>&quot; means any
        governmental, regulatory, supervisory, law enforcement, judicial, or
        quasi-governmental authority having jurisdiction.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Intellectual Property Rights</Strong>&quot; means all
        copyrights, trade marks, service marks, trade secrets, patents, database
        rights, moral rights, and other intellectual property or proprietary
        rights.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Operator</Strong>&quot; means Temple Foundation, an
        exempted foundation company incorporated in the Cayman Islands, and
        &quot;we&quot;, &quot;us&quot; and &quot;our&quot; shall be construed
        accordingly.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Person</Strong>&quot; means any individual, corporation,
        partnership, foundation company, trust, unincorporated association,
        government, state or agency of a state, or other entity.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Privacy Policy</Strong>&quot; means the{' '}
        <ExternalLink
          href="/privacypolicy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </ExternalLink>{' '}
        as updated from time to time.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Relevant Party</Strong>&quot; means the Operator, its
        Affiliates, and each of their respective directors, officers, employees,
        contractors, agents, licensors, and service providers.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Restricted Jurisdiction</Strong>&quot; means the United
        States of America (including its territories) and any other jurisdiction
        designated by the Operator from time to time, including jurisdictions
        where the Services are unlawful or present sanctions/AML risk.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Restricted Person</Strong>&quot; means any Person that is:
        (a) located in, resident in, organised under the laws of, or acting on
        behalf of a person in a Restricted Jurisdiction; (b) listed on, or owned
        or controlled by, any person listed on, any sanctions list administered
        by the UN, US, UK, EU, or other relevant authority; or (c) otherwise
        subject to sanctions or similar restrictions under Applicable Law.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Sanctioned Person</Strong>&quot; means any Person that is
        (a) listed on a sanctions-related list, including the UN Security
        Council sanctions list, OFAC&apos;s SDN list, the UK sanctions list, or
        the EU consolidated list, or (b) owned or Controlled (directly or
        indirectly) by any such Person, or (c) otherwise the target of
        Sanctions.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Sanctions</Strong>&quot; means economic or financial
        sanctions, trade embargoes, export controls, or restrictive measures
        administered or enforced by any Governmental Authority, including
        (without limitation) the United Nations, the United States, the United
        Kingdom, and the European Union.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Services</Strong>&quot; means the Website and all related
        interfaces, tools, features, content, and services made available by the
        Operator through Spice Bazaar.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Smart Contract</Strong>&quot; means one or more smart
        contracts deployed on a blockchain network that you may interact with
        via the Services, including any auction and token contracts.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>TGLD</Strong>&quot; means the Digital Asset referred to as
        &quot;Temple Gold&quot;, if and when enabled.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Third Party</Strong>&quot; means any Person other than you
        and the Operator.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Third-Party Platform</Strong>&quot; means any third-party
        website, wallet, marketplace, protocol, payment processor, service
        provider, or platform integrated with or linked from the Services.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Treasury</Strong>&quot; means the digital asset treasury
        operated for TempleDAO-related activities, as described in the Services,
        if and when applicable.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>USDS</Strong>&quot; means the Digital Asset identified as
        USDS (or any successor/renamed asset) designated in the Services for
        participation in certain auctions, if and when applicable.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>User</Strong>&quot; means any person or entity that
        accesses or uses the Services.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>User Content</Strong>&quot; means any content submitted,
        posted, uploaded, or otherwise provided by you through the Services.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Wallet</Strong>&quot; means a non-custodial digital wallet
        address or account you control that may be used to interact with Digital
        Assets.
      </Paragraph>

      <Paragraph>
        &quot;<Strong>Website</Strong>&quot; means https://templedao.link, any
        successor or additional domains, subdomains, or mirrors designated by
        the Operator from time to time, and all associated pages.
      </Paragraph>

      <Paragraph>
        <Strong>Construction</Strong>:
      </Paragraph>

      <Paragraph>(a) singular includes plural and vice versa;</Paragraph>

      <Paragraph>(b) headings are for convenience only;</Paragraph>

      <Paragraph>
        (c) &quot;including&quot; means &quot;including without
        limitation&quot;;
      </Paragraph>

      <Paragraph>
        (d) references to &quot;you/your&quot; refer to the User.
      </Paragraph>
    </>
  );
};

const Heading = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0 0 16px 0;

  ${breakpoints.phoneAndAbove(`
    font-size: 20px;
  `)}
`;

const Paragraph = styled.p`
  margin: 0 0 16px 0;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const Strong = styled.strong`
  color: ${({ theme }) => theme.palette.brand};
  font-weight: 700;
`;

const ExternalLink = styled.a`
  color: ${({ theme }) => theme.palette.brand};
  text-decoration: underline;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.palette.brandLight};
  }
`;
