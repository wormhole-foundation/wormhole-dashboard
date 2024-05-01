/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/token_router.json`.
 */
export type TokenRouter = {
  address: 'TokenRouter11111111111111111111111111111111';
  metadata: {
    name: 'tokenRouter';
    version: '0.0.0';
    spec: '0.1.0';
    description: 'Example Token Router Program';
    repository: 'https://github.com/wormhole-foundation/example-liquidity-layer';
  };
  instructions: [
    {
      name: 'cancelOwnershipTransferRequest';
      docs: [
        'This instruction cancels an ownership transfer request by resetting the `pending_owner` field',
        'in the `Custodian` account. This instruction can only be called by the `owner`.',
        '# Arguments',
        '',
        '* `ctx` - `CancelOwnershipTransferRequest` context.'
      ];
      discriminator: [167, 61, 9, 35, 192, 41, 64, 178];
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'owner';
              signer: true;
            },
            {
              name: 'custodian';
              writable: true;
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'closePreparedOrder';
      docs: [
        'This instruction is used to close a `PreparedOrder` account. This allows users to cancel',
        'an outbound transfer in case the order is no longer needed, or they made a mistake',
        'in the order. The `prepared_custody_token` account is closed and the tokens are refunded',
        'to the `refund_token` account. This instruction can only be called by the `order_sender`.',
        '# Arguments',
        '',
        '* `ctx` - `ClosePreparedOrder` context.'
      ];
      discriminator: [80, 86, 214, 135, 92, 228, 169, 130];
      accounts: [
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
            }
          ];
        },
        {
          name: 'orderSender';
          docs: ['This signer must be the same one encoded in the prepared order.'];
          signer: true;
        },
        {
          name: 'preparedOrder';
          writable: true;
        },
        {
          name: 'preparedBy';
          writable: true;
        },
        {
          name: 'refundToken';
          writable: true;
        },
        {
          name: 'preparedCustodyToken';
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            ''
          ];
          writable: true;
        },
        {
          name: 'tokenProgram';
        }
      ];
      args: [];
    },
    {
      name: 'confirmOwnershipTransferRequest';
      docs: [
        'This instruction confirms the ownership transfer request and sets the new `owner` in the',
        '`Custodian` account. This instruction can only be called by the `pending_owner`. The',
        '`pending_owner` must be the same as the `pending_owner` in the `Custodian` account.',
        '# Arguments',
        '',
        '* `ctx` - `ConfirmOwnershipTransferRequest` context.'
      ];
      discriminator: [118, 148, 109, 68, 201, 30, 139, 53];
      accounts: [
        {
          name: 'pendingOwner';
          docs: ['Must be the pending owner of the program set in the [`OwnerConfig`]', 'account.'];
          signer: true;
        },
        {
          name: 'custodian';
          writable: true;
        }
      ];
      args: [];
    },
    {
      name: 'consumePreparedFill';
      docs: [
        'This instruction is used to consume a `prepared_fill` account. The tokens are transferred from the',
        '`prepared_custody_token` account to the `dst_token` account. The `prepared_custody_token` account is',
        'closed. This instruction can only be called by the `redeemer` that is saved in the `prepared_fill`.',
        '# Arguments',
        '',
        '* `ctx` - `ConsumePreparedFill` context.'
      ];
      discriminator: [190, 236, 129, 230, 103, 120, 195, 167];
      accounts: [
        {
          name: 'redeemer';
          docs: ['This signer must be the same one encoded in the prepared fill.'];
          signer: true;
        },
        {
          name: 'beneficiary';
          docs: [
            'the payer). If someone were to prepare a fill via a redeem fill instruction and he had no',
            'intention of consuming it, he will be out of luck. We will reward the redeemer with the',
            'closed account funds with a payer of his choosing.'
          ];
          writable: true;
        },
        {
          name: 'preparedFill';
          writable: true;
        },
        {
          name: 'dstToken';
          docs: [
            'Destination token account, which the redeemer may not own. But because the redeemer is a',
            'signer and is the one encoded in the Deposit Fill message, he may have the tokens be sent',
            'to any account he chooses (this one).',
            ''
          ];
          writable: true;
        },
        {
          name: 'preparedCustodyToken';
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            ''
          ];
          writable: true;
        },
        {
          name: 'tokenProgram';
        }
      ];
      args: [];
    },
    {
      name: 'initialize';
      docs: [
        "This instruction is be used to generate the program's `custodian` and `auction_config`",
        'configs. It saves the `payer` as the `owner`. Finally, it sets the upgrade',
        'authority to the `upgrade_manager_authority`. Upgrades are managed by the `upgrade_manager_program`.',
        '# Arguments',
        '',
        '* `ctx`            - `Initialize` context.'
      ];
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: 'owner';
          docs: ['Owner of the program, who presumably deployed this program.'];
          writable: true;
          signer: true;
        },
        {
          name: 'custodian';
          docs: [
            'Sender Config account, which saves program data useful for other',
            'instructions, specifically for outbound transfers. Also saves the payer',
            "of the [`initialize`](crate::initialize) instruction as the program's",
            'owner.'
          ];
          writable: true;
        },
        {
          name: 'ownerAssistant';
        },
        {
          name: 'cctpMintRecipient';
          writable: true;
        },
        {
          name: 'mint';
          accounts: [
            {
              name: 'mint';
            }
          ];
        },
        {
          name: 'programData';
          docs: [
            'We use the program data to make sure this owner is the upgrade authority (the true owner,',
            'who deployed this program).'
          ];
          writable: true;
        },
        {
          name: 'upgradeManagerAuthority';
        },
        {
          name: 'upgradeManagerProgram';
        },
        {
          name: 'bpfLoaderUpgradeableProgram';
        },
        {
          name: 'systemProgram';
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'associatedTokenProgram';
        }
      ];
      args: [];
    },
    {
      name: 'migrate';
      docs: [
        'This instruction is used for executing logic during an upgrade. This instruction can only be',
        'called by the `upgrade_manager_program`.',
        '# Arguments',
        '',
        '* `ctx` - `Migrate` context.'
      ];
      discriminator: [155, 234, 231, 146, 236, 158, 162, 30];
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'owner';
              signer: true;
            },
            {
              name: 'custodian';
              accounts: [
                {
                  name: 'custodian';
                }
              ];
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'placeMarketOrderCctp';
      docs: [
        'This instruction is used to place a `MarketOrder`. This order type transfers tokens',
        'from Solana to another registered Token Router endpoint on a different chain. This',
        'instruction requires a `prepared_market_order` account to be present. Note: this',
        'is the only order type on the Solana Token Router currently, and does not pass',
        'through the matching engine.',
        '# Arguments',
        '',
        '* `ctx` - `PlaceMarketOrder` context.'
      ];
      discriminator: [166, 53, 183, 130, 108, 24, 173, 152];
      accounts: [
        {
          name: 'payer';
          docs: ['This account must be the same pubkey as the one who prepared the order.'];
          writable: true;
          signer: true;
        },
        {
          name: 'preparedBy';
          writable: true;
        },
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
            }
          ];
        },
        {
          name: 'preparedOrder';
          writable: true;
        },
        {
          name: 'mint';
          docs: [
            'Circle-supported mint.',
            '',
            "Token Messenger Minter program's local token account."
          ];
          writable: true;
        },
        {
          name: 'preparedCustodyToken';
          docs: [
            'Temporary custody token account. This account will be closed at the end of this instruction.',
            'It just acts as a conduit to allow this program to be the transfer initiator in the CCTP',
            'message.',
            ''
          ];
          writable: true;
        },
        {
          name: 'routerEndpoint';
          docs: [
            'Registered router endpoint representing a foreign Token Router. This account may have a',
            'CCTP domain encoded if this route is CCTP-enabled. For this instruction, it is required that',
            '[RouterEndpoint::cctp_domain] is `Some(value)`.',
            '',
            'Seeds must be \\["registered_emitter", target_chain.to_be_bytes()\\].'
          ];
        },
        {
          name: 'coreBridgeConfig';
          writable: true;
        },
        {
          name: 'coreMessage';
          writable: true;
        },
        {
          name: 'cctpMessage';
          writable: true;
        },
        {
          name: 'coreEmitterSequence';
          writable: true;
        },
        {
          name: 'coreFeeCollector';
          writable: true;
        },
        {
          name: 'tokenMessengerMinterSenderAuthority';
        },
        {
          name: 'messageTransmitterConfig';
          writable: true;
        },
        {
          name: 'tokenMessenger';
        },
        {
          name: 'remoteTokenMessenger';
          docs: ['Messenger Minter program).'];
        },
        {
          name: 'tokenMinter';
          docs: ['CHECK Seeds must be \\["token_minter"\\] (CCTP Token Messenger Minter program).'];
        },
        {
          name: 'localToken';
          docs: [
            'Local token account, which this program uses to validate the `mint` used to burn.',
            ''
          ];
          writable: true;
        },
        {
          name: 'tokenMessengerMinterEventAuthority';
        },
        {
          name: 'coreBridgeProgram';
        },
        {
          name: 'tokenMessengerMinterProgram';
        },
        {
          name: 'messageTransmitterProgram';
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'systemProgram';
        },
        {
          name: 'clock';
        },
        {
          name: 'rent';
        }
      ];
      args: [];
    },
    {
      name: 'prepareMarketOrder';
      docs: [
        'This instruction is used to prepare a `PrepareOrder` account for a market order. The `amount_in`',
        'is transferred from the `source` account to the `prepared_custody_token` account. Anyone',
        'can call this instruction.',
        '# Arguments',
        '',
        '* `ctx` - `PrepareMarketOrder` context.',
        '* `args` - `PreparedMarketOrderArgs` struct, see `prepare.rs` for more info.'
      ];
      discriminator: [19, 157, 161, 196, 88, 176, 70, 21];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
            }
          ];
        },
        {
          name: 'transferAuthority';
          docs: ['The auction participant needs to set approval to this PDA.', ''];
        },
        {
          name: 'preparedOrder';
          writable: true;
          signer: true;
        },
        {
          name: 'senderToken';
          docs: [
            'Token account where assets are burned from. The CCTP Token Messenger Minter program will',
            'burn the configured [amount](TransferTokensWithPayloadArgs::amount) from this account.',
            '',
            '[burn_source_authority](Self::burn_source_authority). Its mint must be USDC.',
            '',
            'NOTE: This token account must have delegated transfer authority to the custodian prior to',
            'invoking this instruction.'
          ];
          writable: true;
        },
        {
          name: 'refundToken';
        },
        {
          name: 'preparedCustodyToken';
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            ''
          ];
          writable: true;
        },
        {
          name: 'usdc';
          accounts: [
            {
              name: 'mint';
            }
          ];
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'systemProgram';
        }
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'prepareMarketOrderArgs';
            };
          };
        }
      ];
    },
    {
      name: 'redeemCctpFill';
      docs: [
        'This instruction is used to redeem a `Fill` VAA and redeem tokens from a CCTP transfer. After',
        'the tokens are minted by the CCTP program, they are transferred to a token custody account.',
        'The `prepared_fill` account is populated with information from the `Fill` vaa. This',
        'This instruction only handles CCTP transfers.',
        '# Arguments',
        '',
        '* `ctx`  - `RedeemCctpFill` context.',
        '* `args` - `CctpMessageArgs` struct, see `redeem_fill/cctp.rs` for more info.'
      ];
      discriminator: [61, 85, 136, 127, 30, 118, 37, 126];
      accounts: [
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
            }
          ];
        },
        {
          name: 'preparedFill';
          accounts: [
            {
              name: 'payer';
              writable: true;
              signer: true;
            },
            {
              name: 'fillVaa';
              accounts: [
                {
                  name: 'vaa';
                }
              ];
            },
            {
              name: 'preparedFill';
              writable: true;
            },
            {
              name: 'custodyToken';
              docs: [
                'Mint recipient token account, which is encoded as the mint recipient in the CCTP message.',
                'The CCTP Token Messenger Minter program will transfer the amount encoded in the CCTP message',
                'from its custody account to this account.',
                ''
              ];
              writable: true;
            },
            {
              name: 'usdc';
              accounts: [
                {
                  name: 'mint';
                }
              ];
            },
            {
              name: 'tokenProgram';
            },
            {
              name: 'systemProgram';
            }
          ];
        },
        {
          name: 'routerEndpoint';
          docs: [
            'Registered emitter account representing a Circle Integration on another network.',
            '',
            'Seeds must be \\["registered_emitter", target_chain.to_be_bytes()\\].'
          ];
        },
        {
          name: 'cctp';
          accounts: [
            {
              name: 'mintRecipient';
              accounts: [
                {
                  name: 'mintRecipient';
                  writable: true;
                }
              ];
            },
            {
              name: 'messageTransmitterAuthority';
            },
            {
              name: 'messageTransmitterConfig';
            },
            {
              name: 'usedNonces';
              docs: ['first_nonce.to_string()\\] (CCTP Message Transmitter program).'];
              writable: true;
            },
            {
              name: 'messageTransmitterEventAuthority';
            },
            {
              name: 'tokenMessenger';
            },
            {
              name: 'remoteTokenMessenger';
              docs: ['Messenger Minter program).'];
            },
            {
              name: 'tokenMinter';
            },
            {
              name: 'localToken';
              docs: [
                "Token Messenger Minter's Local Token account. This program uses the mint of this account to",
                "validate the `mint_recipient` token account's mint.",
                ''
              ];
              writable: true;
            },
            {
              name: 'tokenPair';
              docs: ['Token Messenger Minter program).'];
            },
            {
              name: 'tokenMessengerMinterCustodyToken';
              writable: true;
            },
            {
              name: 'tokenMessengerMinterEventAuthority';
            },
            {
              name: 'tokenMessengerMinterProgram';
            },
            {
              name: 'messageTransmitterProgram';
            }
          ];
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'systemProgram';
        }
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'cctpMessageArgs';
            };
          };
        }
      ];
    },
    {
      name: 'redeemFastFill';
      docs: [
        'This instruction is used to redeem a `FastFill` VAA created by the matching engine. This instruction',
        'performs a cpi call to the matching engine to complete the fast fill. The tokens transferred to the',
        '`prepared_custody_token` account, and a `prepared_fill` account is created. This instruction only',
        'handles fast fills.',
        '# Arguments',
        '',
        '* `ctx` - `RedeemFastFill` context.'
      ];
      discriminator: [11, 52, 181, 5, 101, 194, 200, 15];
      accounts: [
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
            }
          ];
        },
        {
          name: 'preparedFill';
          accounts: [
            {
              name: 'payer';
              writable: true;
              signer: true;
            },
            {
              name: 'fillVaa';
              accounts: [
                {
                  name: 'vaa';
                }
              ];
            },
            {
              name: 'preparedFill';
              writable: true;
            },
            {
              name: 'custodyToken';
              docs: [
                'Mint recipient token account, which is encoded as the mint recipient in the CCTP message.',
                'The CCTP Token Messenger Minter program will transfer the amount encoded in the CCTP message',
                'from its custody account to this account.',
                ''
              ];
              writable: true;
            },
            {
              name: 'usdc';
              accounts: [
                {
                  name: 'mint';
                }
              ];
            },
            {
              name: 'tokenProgram';
            },
            {
              name: 'systemProgram';
            }
          ];
        },
        {
          name: 'matchingEngineCustodian';
          writable: true;
        },
        {
          name: 'matchingEngineRedeemedFastFill';
          writable: true;
        },
        {
          name: 'matchingEngineFromEndpoint';
        },
        {
          name: 'matchingEngineToEndpoint';
        },
        {
          name: 'matchingEngineLocalCustodyToken';
          docs: ['(Matching Engine program).'];
          writable: true;
        },
        {
          name: 'matchingEngineProgram';
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'systemProgram';
        }
      ];
      args: [];
    },
    {
      name: 'setPause';
      docs: [
        'This instruction is used to pause or unpause further processing of new transfer. Only the `owner`',
        'or `owner_assistant` can pause the program.',
        '# Arguments',
        '',
        '* `ctx`   - `SetPause` context.',
        '* `pause` - Boolean indicating whether to pause the program.'
      ];
      discriminator: [63, 32, 154, 2, 56, 103, 79, 45];
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'ownerOrAssistant';
              signer: true;
            },
            {
              name: 'custodian';
              writable: true;
            }
          ];
        }
      ];
      args: [
        {
          name: 'paused';
          type: 'bool';
        }
      ];
    },
    {
      name: 'submitOwnershipTransferRequest';
      docs: [
        'This instruction sets the `pending_owner` field in the `Custodian` account. This instruction',
        'can only be called by the `owner`. The `pending_owner` address must be valid, meaning it',
        'cannot be the zero address or the current owner.',
        '# Arguments',
        '',
        '* `ctx` - `SubmitOwnershipTransferRequest` context.'
      ];
      discriminator: [215, 13, 88, 199, 48, 195, 19, 225];
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'owner';
              signer: true;
            },
            {
              name: 'custodian';
              writable: true;
            }
          ];
        },
        {
          name: 'newOwner';
          docs: ['New Owner.', ''];
        }
      ];
      args: [];
    },
    {
      name: 'updateOwnerAssistant';
      docs: [
        'This instruction is used to update the `owner_assistant` field in the `Custodian` account. This',
        'instruction can only be called by the `owner`.',
        '# Arguments',
        '',
        '* `ctx` - `UpdateOwnerAssistant` context.'
      ];
      discriminator: [153, 83, 175, 53, 168, 34, 131, 22];
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'owner';
              signer: true;
            },
            {
              name: 'custodian';
              writable: true;
            }
          ];
        },
        {
          name: 'newOwnerAssistant';
          docs: ['New Assistant.', ''];
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: 'custodian';
      discriminator: [132, 228, 139, 184, 112, 228, 108, 240];
    },
    {
      name: 'preparedFill';
      discriminator: [202, 241, 65, 186, 110, 235, 238, 80];
    },
    {
      name: 'preparedOrder';
      discriminator: [3, 21, 13, 182, 167, 149, 128, 118];
    },
    {
      name: 'routerEndpoint';
      discriminator: [217, 148, 188, 203, 183, 105, 154, 205];
    }
  ];
  errors: [
    {
      code: 6002;
      name: 'ownerOnly';
    },
    {
      code: 6004;
      name: 'ownerOrAssistantOnly';
    },
    {
      code: 6016;
      name: 'u64Overflow';
    },
    {
      code: 6048;
      name: 'invalidVaa';
    },
    {
      code: 6068;
      name: 'invalidDepositMessage';
    },
    {
      code: 6070;
      name: 'invalidPayloadId';
    },
    {
      code: 6078;
      name: 'redeemerMessageTooLarge';
    },
    {
      code: 6096;
      name: 'invalidSourceRouter';
    },
    {
      code: 6098;
      name: 'invalidTargetRouter';
    },
    {
      code: 6100;
      name: 'endpointDisabled';
    },
    {
      code: 6102;
      name: 'invalidCctpEndpoint';
    },
    {
      code: 6128;
      name: 'paused';
    },
    {
      code: 6256;
      name: 'assistantZeroPubkey';
    },
    {
      code: 6258;
      name: 'immutableProgram';
    },
    {
      code: 6514;
      name: 'invalidNewOwner';
    },
    {
      code: 6516;
      name: 'alreadyOwner';
    },
    {
      code: 6518;
      name: 'noTransferOwnershipRequest';
    },
    {
      code: 6520;
      name: 'notPendingOwner';
    },
    {
      code: 7024;
      name: 'insufficientAmount';
    },
    {
      code: 7026;
      name: 'minAmountOutTooHigh';
    },
    {
      code: 7028;
      name: 'invalidRedeemer';
    }
  ];
  types: [
    {
      name: 'cctpMessageArgs';
      docs: ['Arguments for [redeem_cctp_fill].'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'encodedCctpMessage';
            docs: ['CCTP message.'];
            type: 'bytes';
          },
          {
            name: 'cctpAttestation';
            docs: ['Attestation of [encoded_cctp_message](Self::encoded_cctp_message).'];
            type: 'bytes';
          }
        ];
      };
    },
    {
      name: 'custodian';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'paused';
            docs: ['Boolean indicating whether outbound transfers are paused.'];
            type: 'bool';
          },
          {
            name: 'owner';
            docs: ["Program's owner."];
            type: 'pubkey';
          },
          {
            name: 'pendingOwner';
            type: {
              option: 'pubkey';
            };
          },
          {
            name: 'ownerAssistant';
            docs: ["Program's assistant. Can be used to update the relayer fee and swap rate."];
            type: 'pubkey';
          },
          {
            name: 'pausedSetBy';
            docs: [
              'Indicate who last set the `paused` value. When the program is first initialized, this is set',
              'to the `owner`.'
            ];
            type: 'pubkey';
          }
        ];
      };
    },
    {
      name: 'endpointInfo';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'chain';
            docs: ["Emitter chain. Cannot equal `1` (Solana's Chain ID)."];
            type: 'u16';
          },
          {
            name: 'address';
            docs: ['Emitter address. Cannot be zero address.'];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'mintRecipient';
            docs: [
              'Future-proof field in case another network has token accounts to send assets to instead of',
              'sending to the address directly.'
            ];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'protocol';
            docs: ['Specific message protocol used to move assets.'];
            type: {
              defined: {
                name: 'messageProtocol';
              };
            };
          }
        ];
      };
    },
    {
      name: 'fillType';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'unset';
          },
          {
            name: 'wormholeCctpDeposit';
          },
          {
            name: 'fastFill';
          }
        ];
      };
    },
    {
      name: 'messageProtocol';
      docs: ['Protocol used to transfer assets.'];
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'none';
          },
          {
            name: 'local';
            fields: [
              {
                name: 'programId';
                type: 'pubkey';
              }
            ];
          },
          {
            name: 'cctp';
            fields: [
              {
                name: 'domain';
                docs: ['CCTP domain, which is how CCTP registers identifies foreign networks.'];
                type: 'u32';
              }
            ];
          }
        ];
      };
    },
    {
      name: 'orderType';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'market';
            fields: [
              {
                name: 'minAmountOut';
                type: {
                  option: 'u64';
                };
              }
            ];
          }
        ];
      };
    },
    {
      name: 'prepareMarketOrderArgs';
      docs: ['Arguments for [prepare_market_order].'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'amountIn';
            docs: ['Amount of tokens to transfer.'];
            type: 'u64';
          },
          {
            name: 'minAmountOut';
            docs: [
              'If provided, minimum amount of tokens to receive in exchange for',
              '[amount_in](Self::amount_in).'
            ];
            type: {
              option: 'u64';
            };
          },
          {
            name: 'targetChain';
            docs: ['The Wormhole chain ID of the network to transfer tokens to.'];
            type: 'u16';
          },
          {
            name: 'redeemer';
            docs: ['The address of the redeeming contract on the target chain.'];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'redeemerMessage';
            docs: [
              'Arbitrary payload to be sent to the [redeemer](Self::redeemer), which can be used to encode',
              "instructions or data for another network's smart contract."
            ];
            type: 'bytes';
          }
        ];
      };
    },
    {
      name: 'preparedFill';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'info';
            type: {
              defined: {
                name: 'preparedFillInfo';
              };
            };
          },
          {
            name: 'redeemerMessage';
            type: 'bytes';
          }
        ];
      };
    },
    {
      name: 'preparedFillInfo';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vaaHash';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'preparedCustodyTokenBump';
            type: 'u8';
          },
          {
            name: 'preparedBy';
            type: 'pubkey';
          },
          {
            name: 'fillType';
            type: {
              defined: {
                name: 'fillType';
              };
            };
          },
          {
            name: 'sourceChain';
            type: 'u16';
          },
          {
            name: 'orderSender';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'redeemer';
            type: 'pubkey';
          }
        ];
      };
    },
    {
      name: 'preparedOrder';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'info';
            type: {
              defined: {
                name: 'preparedOrderInfo';
              };
            };
          },
          {
            name: 'redeemerMessage';
            type: 'bytes';
          }
        ];
      };
    },
    {
      name: 'preparedOrderInfo';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'preparedCustodyTokenBump';
            type: 'u8';
          },
          {
            name: 'orderSender';
            type: 'pubkey';
          },
          {
            name: 'preparedBy';
            type: 'pubkey';
          },
          {
            name: 'orderType';
            type: {
              defined: {
                name: 'orderType';
              };
            };
          },
          {
            name: 'srcToken';
            type: 'pubkey';
          },
          {
            name: 'refundToken';
            type: 'pubkey';
          },
          {
            name: 'targetChain';
            type: 'u16';
          },
          {
            name: 'redeemer';
            type: {
              array: ['u8', 32];
            };
          }
        ];
      };
    },
    {
      name: 'routerEndpoint';
      docs: ['Foreign emitter account data.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'info';
            type: {
              defined: {
                name: 'endpointInfo';
              };
            };
          }
        ];
      };
    }
  ];
};
