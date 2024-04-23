import { ethers } from 'ethers';

export type Cctp = {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  nonce: bigint;
  sender: Array<number>;
  recipient: Array<number>;
  targetCaller: Array<number>;
};

// Taken from https://developers.circle.com/stablecoins/docs/message-format.
export class CctpMessage {
  cctp: Cctp;
  message: Buffer;

  constructor(cctp: Cctp, message: Buffer) {
    this.cctp = cctp;
    this.message = message;
  }

  static from(message: CctpMessage | Buffer): CctpMessage {
    if (message instanceof CctpMessage) {
      return message;
    } else {
      return CctpMessage.decode(message);
    }
  }

  static decode(buf: Readonly<Buffer>): CctpMessage {
    const version = buf.readUInt32BE(0);
    const sourceDomain = buf.readUInt32BE(4);
    const destinationDomain = buf.readUInt32BE(8);
    const nonce = buf.readBigUInt64BE(12);
    const sender = Array.from(buf.slice(20, 52));
    const recipient = Array.from(buf.slice(52, 84));
    const targetCaller = Array.from(buf.slice(84, 116));
    const message = buf.subarray(116);

    return new CctpMessage(
      {
        version,
        sourceDomain,
        destinationDomain,
        nonce,
        sender,
        recipient,
        targetCaller,
      },
      message
    );
  }

  encode(): Buffer {
    const { cctp, message } = this;
    return Buffer.concat([encodeCctp(cctp), message]);
  }
}

export class CctpTokenBurnMessage {
  cctp: Cctp;
  version: number;
  burnTokenAddress: Array<number>;
  mintRecipient: Array<number>;
  amount: bigint;
  sender: Array<number>;

  constructor(
    cctp: Cctp,
    version: number,
    burnTokenAddress: Array<number>,
    mintRecipient: Array<number>,
    amount: bigint,
    sender: Array<number>
  ) {
    this.cctp = cctp;
    this.version = version;
    this.burnTokenAddress = burnTokenAddress;
    this.mintRecipient = mintRecipient;
    this.amount = amount;
    this.sender = sender;
  }

  static from(message: CctpTokenBurnMessage | Buffer): CctpTokenBurnMessage {
    if (message instanceof CctpTokenBurnMessage) {
      return message;
    } else {
      return CctpTokenBurnMessage.decode(message);
    }
  }

  static decode(buf: Readonly<Buffer>): CctpTokenBurnMessage {
    const { cctp, message } = CctpMessage.decode(buf);
    const version = message.readUInt32BE(0);
    const burnTokenAddress = Array.from(message.subarray(4, 36));
    const mintRecipient = Array.from(message.subarray(36, 68));
    const amount = BigInt(ethers.BigNumber.from(message.subarray(68, 100)).toString());
    const sender = Array.from(message.subarray(100, 132));

    return new CctpTokenBurnMessage(cctp, version, burnTokenAddress, mintRecipient, amount, sender);
  }

  encode(): Buffer {
    const buf = Buffer.alloc(132);

    const { cctp, version, burnTokenAddress, mintRecipient, amount, sender } = this;

    let offset = 0;
    offset = buf.writeUInt32BE(version, offset);
    buf.set(burnTokenAddress, offset);
    offset += 32;
    buf.set(mintRecipient, offset);
    offset += 32;

    // Special handling w/ uint256. This value will most likely encoded in < 32 bytes, so we
    // jump ahead by 32 and subtract the length of the encoded value.
    const encodedAmount = ethers.utils.arrayify(ethers.BigNumber.from(amount.toString()));
    buf.set(encodedAmount, (offset += 32) - encodedAmount.length);

    buf.set(sender, offset);
    offset += 32;

    return Buffer.concat([encodeCctp(cctp), buf]);
  }
}

function encodeCctp(cctp: Cctp): Buffer {
  const buf = Buffer.alloc(116);

  const { version, sourceDomain, destinationDomain, nonce, sender, recipient, targetCaller } = cctp;

  let offset = 0;
  offset = buf.writeUInt32BE(version, offset);
  offset = buf.writeUInt32BE(sourceDomain, offset);
  offset = buf.writeUInt32BE(destinationDomain, offset);
  offset = buf.writeBigUInt64BE(nonce, offset);
  buf.set(sender, offset);
  offset += 32;
  buf.set(recipient, offset);
  offset += 32;
  buf.set(targetCaller, offset);

  return buf;
}
