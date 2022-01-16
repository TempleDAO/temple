import { ethers } from 'hardhat'
import { Signer, BigNumber } from 'ethers'
import { expect } from 'chai'
import {
    TempleERC20Token,
    TempleERC20Token__factory,
    TempleCashback__factory,
    TempleCashback,
} from '../typechain'
import { shouldThrow, toAtto, fromAtto } from './helpers'

describe('Test Temple Cashback', async () => {
    const value = toAtto(10)
    const nonce = 1

    let TEMPLE: TempleERC20Token
    let Cashback: TempleCashback
    let owner: Signer
    let unapproved: Signer
    let approved: Signer

    beforeEach(async () => {
        ;[owner, unapproved, approved] = await ethers.getSigners()

        TEMPLE = await new TempleERC20Token__factory(owner).deploy()
        Cashback = await new TempleCashback__factory(owner).deploy(
            await owner.getAddress()
        )
        await TEMPLE.addMinter(await owner.getAddress())
        await TEMPLE.mint(await owner.getAddress(), toAtto(10000))

        // Deposit TEMPLE to TempleCashback Contract
        Promise.all([
            await TEMPLE.connect(owner).transfer(
                Cashback.address,
                toAtto(1000)
            ),
        ])
    })

    it('Only owner can withdraw', async () => {
        // Validate owner can withdraw and receive tokens
        await expect(
            async () =>
                await Cashback.connect(owner).withdraw(
                    TEMPLE.address,
                    toAtto(500)
                )
        ).to.changeTokenBalance(TEMPLE, owner, toAtto(500))
        // Non-owner throws error on withdraw
        await shouldThrow(
            Cashback.connect(unapproved).withdraw(TEMPLE.address, toAtto(1000)),
            /Ownable: caller is not the owner/
        )
    })

    it('Only owner can update verifier', async () => {
        const approvedAddr: string = await approved.getAddress()
        // Non-owner throws error
        await shouldThrow(
            Cashback.connect(unapproved).setVerifier(approvedAddr),
            /Ownable: caller is not the owner/
        )
        // Validate owner can update signer
        await Cashback.connect(owner).setVerifier(approvedAddr)
        await expect(await Cashback.verifier()).to.equal(approvedAddr)
    })

    it('Address with verified signature can withdraw funds', async () => {
        // Approved address can claim funds
        let { signature, hash } = await createSignature(
            Cashback.address,
            TEMPLE.address,
            await approved.getAddress(),
            value,
            nonce
        )
        await expect(
            async () =>
                await Cashback.connect(approved).claim(
                    hash,
                    signature,
                    TEMPLE.address,
                    value,
                    nonce
                )
        ).to.changeTokenBalance(TEMPLE, approved, value)

        // Unapproved address cannot claim funds
        await shouldThrow(
            Cashback.connect(unapproved).claim(
                hash,
                signature,
                TEMPLE.address,
                value,
                nonce
            ),
            /Hash fail/
        )
    })

    it('Cannot withdraw more funds than allocated', async () => {
        let { signature, hash } = await createSignature(
            Cashback.address,
            TEMPLE.address,
            await approved.getAddress(),
            toAtto(10),
            nonce
        )
        await shouldThrow(
            Cashback.connect(approved).claim(
                hash,
                signature,
                TEMPLE.address,
                toAtto(100),
                nonce
            ),
            /Hash fail/
        )
    })

    it('Signature cannot be re-used', async () => {
        let { signature, hash } = await createSignature(
            Cashback.address,
            TEMPLE.address,
            await approved.getAddress(),
            value,
            nonce
        )
        // First claim should work
        await expect(
            async () =>
                await Cashback.connect(approved).claim(
                    hash,
                    signature,
                    TEMPLE.address,
                    value,
                    nonce
                )
        ).to.changeTokenBalance(TEMPLE, approved, value)
        // Second claim with same signature should fail
        await shouldThrow(
            Cashback.connect(approved).claim(
                hash,
                signature,
                TEMPLE.address,
                value,
                nonce
            ),
            /Hash used/
        )
    })
})

async function createSignature(
    cashbackAddress: string,
    tokenAddress: string,
    recipient: string,
    tokenQuantity: BigNumber,
    nonce: number
) {
    const ownerAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    const wallet = await ethers.getSigner(ownerAddress)
    const abi = new ethers.utils.AbiCoder()

    // Generate hash
    const typeHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
        )
    )
    const nameHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes('TempleCashback')
    )
    const versionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('1'))
    const chainId = await wallet.getChainId()
    const domainSeparator = ethers.utils.keccak256(
        abi.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [typeHash, nameHash, versionHash, chainId, cashbackAddress]
        )
    )
    const VERIFY_TYPEHASH = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(
            'Claim(address tokenAddress,address recipient,uint256 tokenQuantity,uint256 nonce)'
        )
    )
    const structHash = ethers.utils.keccak256(
        abi.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256'],
            [VERIFY_TYPEHASH, tokenAddress, recipient, tokenQuantity, nonce]
        )
    )
    let encoded = abi.encode(
        ['bytes32', 'bytes32'],
        [domainSeparator, structHash]
    )
    // Add 0x1901 to match the ECDSA.toTypedDataHash() spec
    const hash = ethers.utils.keccak256('0x1901' + encoded.slice(2))

    // Generate signature
    const domain = {
        name: 'TempleCashback',
        version: '1',
        chainId: chainId,
        verifyingContract: cashbackAddress,
    }
    const types = {
        Claim: [
            {
                name: 'tokenAddress',
                type: 'address',
            },
            {
                name: 'recipient',
                type: 'address',
            },
            {
                name: 'tokenQuantity',
                type: 'uint256',
            },
            {
                name: 'nonce',
                type: 'uint256',
            },
        ],
    }
    const value = {
        tokenAddress,
        recipient,
        tokenQuantity,
        nonce,
    }
    const signature = await wallet._signTypedData(domain, types, value)

    return { signature, hash }
}
