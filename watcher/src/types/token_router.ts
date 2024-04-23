export type TokenRouter = {
  version: '0.0.0';
  name: 'token_router';
  instructions: [
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
      accounts: [
        {
          name: 'owner';
          isMut: true;
          isSigner: true;
          docs: ['Owner of the program, who presumably deployed this program.'];
        },
        {
          name: 'custodian';
          isMut: true;
          isSigner: false;
          docs: [
            'Sender Config account, which saves program data useful for other',
            'instructions, specifically for outbound transfers. Also saves the payer',
            "of the [`initialize`](crate::initialize) instruction as the program's",
            'owner.'
          ];
        },
        {
          name: 'ownerAssistant';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'cctpMintRecipient';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'programData';
          isMut: true;
          isSigner: false;
          docs: [
            'We use the program data to make sure this owner is the upgrade authority (the true owner,',
            'who deployed this program).'
          ];
        },
        {
          name: 'upgradeManagerAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'upgradeManagerProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'bpfLoaderUpgradeableProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
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
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'owner';
              isMut: false;
              isSigner: true;
            },
            {
              name: 'custodian';
              isMut: true;
              isSigner: false;
            }
          ];
        },
        {
          name: 'newOwner';
          isMut: false;
          isSigner: false;
          docs: ['New Owner.', ''];
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
      accounts: [
        {
          name: 'pendingOwner';
          isMut: false;
          isSigner: true;
          docs: ['Must be the pending owner of the program set in the [`OwnerConfig`]', 'account.'];
        },
        {
          name: 'custodian';
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: 'cancelOwnershipTransferRequest';
      docs: [
        'This instruction cancels an ownership transfer request by resetting the `pending_owner` field',
        'in the `Custodian` account. This instruction can only be called by the `owner`.',
        '# Arguments',
        '',
        '* `ctx` - `CancelOwnershipTransferRequest` context.'
      ];
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'owner';
              isMut: false;
              isSigner: true;
            },
            {
              name: 'custodian';
              isMut: true;
              isSigner: false;
            }
          ];
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
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'owner';
              isMut: false;
              isSigner: true;
            },
            {
              name: 'custodian';
              isMut: true;
              isSigner: false;
            }
          ];
        },
        {
          name: 'newOwnerAssistant';
          isMut: false;
          isSigner: false;
          docs: ['New Assistant.', ''];
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
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'ownerOrAssistant';
              isMut: false;
              isSigner: true;
            },
            {
              name: 'custodian';
              isMut: true;
              isSigner: false;
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
      name: 'migrate';
      docs: [
        'This instruction is used for executing logic during an upgrade. This instruction can only be',
        'called by the `upgrade_manager_program`.',
        '# Arguments',
        '',
        '* `ctx` - `Migrate` context.'
      ];
      accounts: [
        {
          name: 'admin';
          accounts: [
            {
              name: 'owner';
              isMut: false;
              isSigner: true;
            },
            {
              name: 'custodian';
              accounts: [
                {
                  name: 'custodian';
                  isMut: false;
                  isSigner: false;
                }
              ];
            }
          ];
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'transferAuthority';
          isMut: false;
          isSigner: false;
          docs: ['The auction participant needs to set approval to this PDA.', ''];
        },
        {
          name: 'preparedOrder';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'senderToken';
          isMut: true;
          isSigner: false;
          docs: [
            'Token account where assets are burned from. The CCTP Token Messenger Minter program will',
            'burn the configured [amount](TransferTokensWithPayloadArgs::amount) from this account.',
            '',
            '[burn_source_authority](Self::burn_source_authority). Its mint must be USDC.',
            '',
            'NOTE: This token account must have delegated transfer authority to the custodian prior to',
            'invoking this instruction.'
          ];
        },
        {
          name: 'refundToken';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'preparedCustodyToken';
          isMut: true;
          isSigner: false;
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            ''
          ];
        },
        {
          name: 'usdc';
          accounts: [
            {
              name: 'mint';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'PrepareMarketOrderArgs';
          };
        }
      ];
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
      accounts: [
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'orderSender';
          isMut: false;
          isSigner: true;
          docs: ['This signer must be the same one encoded in the prepared order.'];
        },
        {
          name: 'preparedOrder';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'preparedBy';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'refundToken';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'preparedCustodyToken';
          isMut: true;
          isSigner: false;
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            ''
          ];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['This account must be the same pubkey as the one who prepared the order.'];
        },
        {
          name: 'preparedBy';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'preparedOrder';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: true;
          isSigner: false;
          docs: [
            'Circle-supported mint.',
            '',
            "Token Messenger Minter program's local token account."
          ];
        },
        {
          name: 'preparedCustodyToken';
          isMut: true;
          isSigner: false;
          docs: [
            'Temporary custody token account. This account will be closed at the end of this instruction.',
            'It just acts as a conduit to allow this program to be the transfer initiator in the CCTP',
            'message.',
            ''
          ];
        },
        {
          name: 'routerEndpoint';
          isMut: false;
          isSigner: false;
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
          isMut: true;
          isSigner: false;
        },
        {
          name: 'coreMessage';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'cctpMessage';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'coreEmitterSequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'coreFeeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenMessengerMinterSenderAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'messageTransmitterConfig';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenMessenger';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'remoteTokenMessenger';
          isMut: false;
          isSigner: false;
          docs: ['Messenger Minter program).'];
        },
        {
          name: 'tokenMinter';
          isMut: false;
          isSigner: false;
          docs: ['CHECK Seeds must be \\["token_minter"\\] (CCTP Token Messenger Minter program).'];
        },
        {
          name: 'localToken';
          isMut: true;
          isSigner: false;
          docs: [
            'Local token account, which this program uses to validate the `mint` used to burn.',
            ''
          ];
        },
        {
          name: 'tokenMessengerMinterEventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'coreBridgeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenMessengerMinterProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'messageTransmitterProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
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
      accounts: [
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'preparedFill';
          accounts: [
            {
              name: 'payer';
              isMut: true;
              isSigner: true;
            },
            {
              name: 'fillVaa';
              accounts: [
                {
                  name: 'vaa';
                  isMut: false;
                  isSigner: false;
                }
              ];
            },
            {
              name: 'preparedFill';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'custodyToken';
              isMut: true;
              isSigner: false;
              docs: [
                'Mint recipient token account, which is encoded as the mint recipient in the CCTP message.',
                'The CCTP Token Messenger Minter program will transfer the amount encoded in the CCTP message',
                'from its custody account to this account.',
                ''
              ];
            },
            {
              name: 'usdc';
              accounts: [
                {
                  name: 'mint';
                  isMut: false;
                  isSigner: false;
                }
              ];
            },
            {
              name: 'tokenProgram';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'systemProgram';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'routerEndpoint';
          isMut: false;
          isSigner: false;
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
                  isMut: true;
                  isSigner: false;
                }
              ];
            },
            {
              name: 'messageTransmitterAuthority';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'messageTransmitterConfig';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'usedNonces';
              isMut: true;
              isSigner: false;
              docs: ['first_nonce.to_string()\\] (CCTP Message Transmitter program).'];
            },
            {
              name: 'messageTransmitterEventAuthority';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'tokenMessenger';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'remoteTokenMessenger';
              isMut: false;
              isSigner: false;
              docs: ['Messenger Minter program).'];
            },
            {
              name: 'tokenMinter';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'localToken';
              isMut: true;
              isSigner: false;
              docs: [
                "Token Messenger Minter's Local Token account. This program uses the mint of this account to",
                "validate the `mint_recipient` token account's mint.",
                ''
              ];
            },
            {
              name: 'tokenPair';
              isMut: false;
              isSigner: false;
              docs: ['Token Messenger Minter program).'];
            },
            {
              name: 'tokenMessengerMinterCustodyToken';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'tokenMessengerMinterEventAuthority';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'tokenMessengerMinterProgram';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'messageTransmitterProgram';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'CctpMessageArgs';
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
      accounts: [
        {
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'preparedFill';
          accounts: [
            {
              name: 'payer';
              isMut: true;
              isSigner: true;
            },
            {
              name: 'fillVaa';
              accounts: [
                {
                  name: 'vaa';
                  isMut: false;
                  isSigner: false;
                }
              ];
            },
            {
              name: 'preparedFill';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'custodyToken';
              isMut: true;
              isSigner: false;
              docs: [
                'Mint recipient token account, which is encoded as the mint recipient in the CCTP message.',
                'The CCTP Token Messenger Minter program will transfer the amount encoded in the CCTP message',
                'from its custody account to this account.',
                ''
              ];
            },
            {
              name: 'usdc';
              accounts: [
                {
                  name: 'mint';
                  isMut: false;
                  isSigner: false;
                }
              ];
            },
            {
              name: 'tokenProgram';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'systemProgram';
              isMut: false;
              isSigner: false;
            }
          ];
        },
        {
          name: 'matchingEngineCustodian';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'matchingEngineRedeemedFastFill';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'matchingEngineFromEndpoint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'matchingEngineToEndpoint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'matchingEngineLocalCustodyToken';
          isMut: true;
          isSigner: false;
          docs: ['(Matching Engine program).'];
        },
        {
          name: 'matchingEngineProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'redeemer';
          isMut: false;
          isSigner: true;
          docs: ['This signer must be the same one encoded in the prepared fill.'];
        },
        {
          name: 'beneficiary';
          isMut: true;
          isSigner: false;
          docs: [
            'the payer). If someone were to prepare a fill via a redeem fill instruction and he had no',
            'intention of consuming it, he will be out of luck. We will reward the redeemer with the',
            'closed account funds with a payer of his choosing.'
          ];
        },
        {
          name: 'preparedFill';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'dstToken';
          isMut: true;
          isSigner: false;
          docs: [
            'Destination token account, which the redeemer may not own. But because the redeemer is a',
            'signer and is the one encoded in the Deposit Fill message, he may have the tokens be sent',
            'to any account he chooses (this one).',
            ''
          ];
        },
        {
          name: 'preparedCustodyToken';
          isMut: true;
          isSigner: false;
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            ''
          ];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    }
  ];
  accounts: [
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
            type: 'publicKey';
          },
          {
            name: 'pendingOwner';
            type: {
              option: 'publicKey';
            };
          },
          {
            name: 'ownerAssistant';
            docs: ["Program's assistant. Can be used to update the relayer fee and swap rate."];
            type: 'publicKey';
          },
          {
            name: 'pausedSetBy';
            docs: [
              'Indicate who last set the `paused` value. When the program is first initialized, this is set',
              'to the `owner`.'
            ];
            type: 'publicKey';
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
              defined: 'PreparedFillInfo';
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
      name: 'preparedOrder';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'info';
            type: {
              defined: 'PreparedOrderInfo';
            };
          },
          {
            name: 'redeemerMessage';
            type: 'bytes';
          }
        ];
      };
    }
  ];
  types: [
    {
      name: 'PrepareMarketOrderArgs';
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
      name: 'CctpMessageArgs';
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
      name: 'PreparedFillInfo';
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
            type: 'publicKey';
          },
          {
            name: 'fillType';
            type: {
              defined: 'FillType';
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
            type: 'publicKey';
          }
        ];
      };
    },
    {
      name: 'PreparedOrderInfo';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'preparedCustodyTokenBump';
            type: 'u8';
          },
          {
            name: 'orderSender';
            type: 'publicKey';
          },
          {
            name: 'preparedBy';
            type: 'publicKey';
          },
          {
            name: 'orderType';
            type: {
              defined: 'OrderType';
            };
          },
          {
            name: 'srcToken';
            type: 'publicKey';
          },
          {
            name: 'refundToken';
            type: 'publicKey';
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
      name: 'FillType';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Unset';
          },
          {
            name: 'WormholeCctpDeposit';
          },
          {
            name: 'FastFill';
          }
        ];
      };
    },
    {
      name: 'OrderType';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Market';
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
    }
  ];
  errors: [
    {
      code: 6002;
      name: 'OwnerOnly';
    },
    {
      code: 6004;
      name: 'OwnerOrAssistantOnly';
    },
    {
      code: 6016;
      name: 'U64Overflow';
    },
    {
      code: 6048;
      name: 'InvalidVaa';
    },
    {
      code: 6068;
      name: 'InvalidDepositMessage';
    },
    {
      code: 6070;
      name: 'InvalidPayloadId';
    },
    {
      code: 6096;
      name: 'InvalidSourceRouter';
    },
    {
      code: 6098;
      name: 'InvalidTargetRouter';
    },
    {
      code: 6100;
      name: 'EndpointDisabled';
    },
    {
      code: 6102;
      name: 'InvalidCctpEndpoint';
    },
    {
      code: 6128;
      name: 'Paused';
    },
    {
      code: 6256;
      name: 'AssistantZeroPubkey';
    },
    {
      code: 6258;
      name: 'ImmutableProgram';
    },
    {
      code: 6514;
      name: 'InvalidNewOwner';
    },
    {
      code: 6516;
      name: 'AlreadyOwner';
    },
    {
      code: 6518;
      name: 'NoTransferOwnershipRequest';
    },
    {
      code: 6520;
      name: 'NotPendingOwner';
    },
    {
      code: 7024;
      name: 'InsufficientAmount';
    },
    {
      code: 7026;
      name: 'MinAmountOutTooHigh';
    },
    {
      code: 7028;
      name: 'InvalidRedeemer';
    }
  ];
};

export const IDL: TokenRouter = {
  version: '0.0.0',
  name: 'token_router',
  instructions: [
    {
      name: 'initialize',
      docs: [
        "This instruction is be used to generate the program's `custodian` and `auction_config`",
        'configs. It saves the `payer` as the `owner`. Finally, it sets the upgrade',
        'authority to the `upgrade_manager_authority`. Upgrades are managed by the `upgrade_manager_program`.',
        '# Arguments',
        '',
        '* `ctx`            - `Initialize` context.',
      ],
      accounts: [
        {
          name: 'owner',
          isMut: true,
          isSigner: true,
          docs: ['Owner of the program, who presumably deployed this program.'],
        },
        {
          name: 'custodian',
          isMut: true,
          isSigner: false,
          docs: [
            'Sender Config account, which saves program data useful for other',
            'instructions, specifically for outbound transfers. Also saves the payer',
            "of the [`initialize`](crate::initialize) instruction as the program's",
            'owner.',
          ],
        },
        {
          name: 'ownerAssistant',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'cctpMintRecipient',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'programData',
          isMut: true,
          isSigner: false,
          docs: [
            'We use the program data to make sure this owner is the upgrade authority (the true owner,',
            'who deployed this program).',
          ],
        },
        {
          name: 'upgradeManagerAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'upgradeManagerProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'bpfLoaderUpgradeableProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'submitOwnershipTransferRequest',
      docs: [
        'This instruction sets the `pending_owner` field in the `Custodian` account. This instruction',
        'can only be called by the `owner`. The `pending_owner` address must be valid, meaning it',
        'cannot be the zero address or the current owner.',
        '# Arguments',
        '',
        '* `ctx` - `SubmitOwnershipTransferRequest` context.',
      ],
      accounts: [
        {
          name: 'admin',
          accounts: [
            {
              name: 'owner',
              isMut: false,
              isSigner: true,
            },
            {
              name: 'custodian',
              isMut: true,
              isSigner: false,
            },
          ],
        },
        {
          name: 'newOwner',
          isMut: false,
          isSigner: false,
          docs: ['New Owner.', ''],
        },
      ],
      args: [],
    },
    {
      name: 'confirmOwnershipTransferRequest',
      docs: [
        'This instruction confirms the ownership transfer request and sets the new `owner` in the',
        '`Custodian` account. This instruction can only be called by the `pending_owner`. The',
        '`pending_owner` must be the same as the `pending_owner` in the `Custodian` account.',
        '# Arguments',
        '',
        '* `ctx` - `ConfirmOwnershipTransferRequest` context.',
      ],
      accounts: [
        {
          name: 'pendingOwner',
          isMut: false,
          isSigner: true,
          docs: ['Must be the pending owner of the program set in the [`OwnerConfig`]', 'account.'],
        },
        {
          name: 'custodian',
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'cancelOwnershipTransferRequest',
      docs: [
        'This instruction cancels an ownership transfer request by resetting the `pending_owner` field',
        'in the `Custodian` account. This instruction can only be called by the `owner`.',
        '# Arguments',
        '',
        '* `ctx` - `CancelOwnershipTransferRequest` context.',
      ],
      accounts: [
        {
          name: 'admin',
          accounts: [
            {
              name: 'owner',
              isMut: false,
              isSigner: true,
            },
            {
              name: 'custodian',
              isMut: true,
              isSigner: false,
            },
          ],
        },
      ],
      args: [],
    },
    {
      name: 'updateOwnerAssistant',
      docs: [
        'This instruction is used to update the `owner_assistant` field in the `Custodian` account. This',
        'instruction can only be called by the `owner`.',
        '# Arguments',
        '',
        '* `ctx` - `UpdateOwnerAssistant` context.',
      ],
      accounts: [
        {
          name: 'admin',
          accounts: [
            {
              name: 'owner',
              isMut: false,
              isSigner: true,
            },
            {
              name: 'custodian',
              isMut: true,
              isSigner: false,
            },
          ],
        },
        {
          name: 'newOwnerAssistant',
          isMut: false,
          isSigner: false,
          docs: ['New Assistant.', ''],
        },
      ],
      args: [],
    },
    {
      name: 'setPause',
      docs: [
        'This instruction is used to pause or unpause further processing of new transfer. Only the `owner`',
        'or `owner_assistant` can pause the program.',
        '# Arguments',
        '',
        '* `ctx`   - `SetPause` context.',
        '* `pause` - Boolean indicating whether to pause the program.',
      ],
      accounts: [
        {
          name: 'admin',
          accounts: [
            {
              name: 'ownerOrAssistant',
              isMut: false,
              isSigner: true,
            },
            {
              name: 'custodian',
              isMut: true,
              isSigner: false,
            },
          ],
        },
      ],
      args: [
        {
          name: 'paused',
          type: 'bool',
        },
      ],
    },
    {
      name: 'migrate',
      docs: [
        'This instruction is used for executing logic during an upgrade. This instruction can only be',
        'called by the `upgrade_manager_program`.',
        '# Arguments',
        '',
        '* `ctx` - `Migrate` context.',
      ],
      accounts: [
        {
          name: 'admin',
          accounts: [
            {
              name: 'owner',
              isMut: false,
              isSigner: true,
            },
            {
              name: 'custodian',
              accounts: [
                {
                  name: 'custodian',
                  isMut: false,
                  isSigner: false,
                },
              ],
            },
          ],
        },
      ],
      args: [],
    },
    {
      name: 'prepareMarketOrder',
      docs: [
        'This instruction is used to prepare a `PrepareOrder` account for a market order. The `amount_in`',
        'is transferred from the `source` account to the `prepared_custody_token` account. Anyone',
        'can call this instruction.',
        '# Arguments',
        '',
        '* `ctx` - `PrepareMarketOrder` context.',
        '* `args` - `PreparedMarketOrderArgs` struct, see `prepare.rs` for more info.',
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'custodian',
          accounts: [
            {
              name: 'custodian',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'transferAuthority',
          isMut: false,
          isSigner: false,
          docs: ['The auction participant needs to set approval to this PDA.', ''],
        },
        {
          name: 'preparedOrder',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'senderToken',
          isMut: true,
          isSigner: false,
          docs: [
            'Token account where assets are burned from. The CCTP Token Messenger Minter program will',
            'burn the configured [amount](TransferTokensWithPayloadArgs::amount) from this account.',
            '',
            '[burn_source_authority](Self::burn_source_authority). Its mint must be USDC.',
            '',
            'NOTE: This token account must have delegated transfer authority to the custodian prior to',
            'invoking this instruction.',
          ],
        },
        {
          name: 'refundToken',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'preparedCustodyToken',
          isMut: true,
          isSigner: false,
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            '',
          ],
        },
        {
          name: 'usdc',
          accounts: [
            {
              name: 'mint',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'PrepareMarketOrderArgs',
          },
        },
      ],
    },
    {
      name: 'closePreparedOrder',
      docs: [
        'This instruction is used to close a `PreparedOrder` account. This allows users to cancel',
        'an outbound transfer in case the order is no longer needed, or they made a mistake',
        'in the order. The `prepared_custody_token` account is closed and the tokens are refunded',
        'to the `refund_token` account. This instruction can only be called by the `order_sender`.',
        '# Arguments',
        '',
        '* `ctx` - `ClosePreparedOrder` context.',
      ],
      accounts: [
        {
          name: 'custodian',
          accounts: [
            {
              name: 'custodian',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'orderSender',
          isMut: false,
          isSigner: true,
          docs: ['This signer must be the same one encoded in the prepared order.'],
        },
        {
          name: 'preparedOrder',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'preparedBy',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'refundToken',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'preparedCustodyToken',
          isMut: true,
          isSigner: false,
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            '',
          ],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'placeMarketOrderCctp',
      docs: [
        'This instruction is used to place a `MarketOrder`. This order type transfers tokens',
        'from Solana to another registered Token Router endpoint on a different chain. This',
        'instruction requires a `prepared_market_order` account to be present. Note: this',
        'is the only order type on the Solana Token Router currently, and does not pass',
        'through the matching engine.',
        '# Arguments',
        '',
        '* `ctx` - `PlaceMarketOrder` context.',
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['This account must be the same pubkey as the one who prepared the order.'],
        },
        {
          name: 'preparedBy',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'custodian',
          accounts: [
            {
              name: 'custodian',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'preparedOrder',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: true,
          isSigner: false,
          docs: [
            'Circle-supported mint.',
            '',
            "Token Messenger Minter program's local token account.",
          ],
        },
        {
          name: 'preparedCustodyToken',
          isMut: true,
          isSigner: false,
          docs: [
            'Temporary custody token account. This account will be closed at the end of this instruction.',
            'It just acts as a conduit to allow this program to be the transfer initiator in the CCTP',
            'message.',
            '',
          ],
        },
        {
          name: 'routerEndpoint',
          isMut: false,
          isSigner: false,
          docs: [
            'Registered router endpoint representing a foreign Token Router. This account may have a',
            'CCTP domain encoded if this route is CCTP-enabled. For this instruction, it is required that',
            '[RouterEndpoint::cctp_domain] is `Some(value)`.',
            '',
            'Seeds must be \\["registered_emitter", target_chain.to_be_bytes()\\].',
          ],
        },
        {
          name: 'coreBridgeConfig',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'coreMessage',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'cctpMessage',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'coreEmitterSequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'coreFeeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenMessengerMinterSenderAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'messageTransmitterConfig',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenMessenger',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'remoteTokenMessenger',
          isMut: false,
          isSigner: false,
          docs: ['Messenger Minter program).'],
        },
        {
          name: 'tokenMinter',
          isMut: false,
          isSigner: false,
          docs: ['CHECK Seeds must be \\["token_minter"\\] (CCTP Token Messenger Minter program).'],
        },
        {
          name: 'localToken',
          isMut: true,
          isSigner: false,
          docs: [
            'Local token account, which this program uses to validate the `mint` used to burn.',
            '',
          ],
        },
        {
          name: 'tokenMessengerMinterEventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'coreBridgeProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenMessengerMinterProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'messageTransmitterProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'redeemCctpFill',
      docs: [
        'This instruction is used to redeem a `Fill` VAA and redeem tokens from a CCTP transfer. After',
        'the tokens are minted by the CCTP program, they are transferred to a token custody account.',
        'The `prepared_fill` account is populated with information from the `Fill` vaa. This',
        'This instruction only handles CCTP transfers.',
        '# Arguments',
        '',
        '* `ctx`  - `RedeemCctpFill` context.',
        '* `args` - `CctpMessageArgs` struct, see `redeem_fill/cctp.rs` for more info.',
      ],
      accounts: [
        {
          name: 'custodian',
          accounts: [
            {
              name: 'custodian',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'preparedFill',
          accounts: [
            {
              name: 'payer',
              isMut: true,
              isSigner: true,
            },
            {
              name: 'fillVaa',
              accounts: [
                {
                  name: 'vaa',
                  isMut: false,
                  isSigner: false,
                },
              ],
            },
            {
              name: 'preparedFill',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'custodyToken',
              isMut: true,
              isSigner: false,
              docs: [
                'Mint recipient token account, which is encoded as the mint recipient in the CCTP message.',
                'The CCTP Token Messenger Minter program will transfer the amount encoded in the CCTP message',
                'from its custody account to this account.',
                '',
              ],
            },
            {
              name: 'usdc',
              accounts: [
                {
                  name: 'mint',
                  isMut: false,
                  isSigner: false,
                },
              ],
            },
            {
              name: 'tokenProgram',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'systemProgram',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'routerEndpoint',
          isMut: false,
          isSigner: false,
          docs: [
            'Registered emitter account representing a Circle Integration on another network.',
            '',
            'Seeds must be \\["registered_emitter", target_chain.to_be_bytes()\\].',
          ],
        },
        {
          name: 'cctp',
          accounts: [
            {
              name: 'mintRecipient',
              accounts: [
                {
                  name: 'mintRecipient',
                  isMut: true,
                  isSigner: false,
                },
              ],
            },
            {
              name: 'messageTransmitterAuthority',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'messageTransmitterConfig',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'usedNonces',
              isMut: true,
              isSigner: false,
              docs: ['first_nonce.to_string()\\] (CCTP Message Transmitter program).'],
            },
            {
              name: 'messageTransmitterEventAuthority',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'tokenMessenger',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'remoteTokenMessenger',
              isMut: false,
              isSigner: false,
              docs: ['Messenger Minter program).'],
            },
            {
              name: 'tokenMinter',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'localToken',
              isMut: true,
              isSigner: false,
              docs: [
                "Token Messenger Minter's Local Token account. This program uses the mint of this account to",
                "validate the `mint_recipient` token account's mint.",
                '',
              ],
            },
            {
              name: 'tokenPair',
              isMut: false,
              isSigner: false,
              docs: ['Token Messenger Minter program).'],
            },
            {
              name: 'tokenMessengerMinterCustodyToken',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'tokenMessengerMinterEventAuthority',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'tokenMessengerMinterProgram',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'messageTransmitterProgram',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'CctpMessageArgs',
          },
        },
      ],
    },
    {
      name: 'redeemFastFill',
      docs: [
        'This instruction is used to redeem a `FastFill` VAA created by the matching engine. This instruction',
        'performs a cpi call to the matching engine to complete the fast fill. The tokens transferred to the',
        '`prepared_custody_token` account, and a `prepared_fill` account is created. This instruction only',
        'handles fast fills.',
        '# Arguments',
        '',
        '* `ctx` - `RedeemFastFill` context.',
      ],
      accounts: [
        {
          name: 'custodian',
          accounts: [
            {
              name: 'custodian',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'preparedFill',
          accounts: [
            {
              name: 'payer',
              isMut: true,
              isSigner: true,
            },
            {
              name: 'fillVaa',
              accounts: [
                {
                  name: 'vaa',
                  isMut: false,
                  isSigner: false,
                },
              ],
            },
            {
              name: 'preparedFill',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'custodyToken',
              isMut: true,
              isSigner: false,
              docs: [
                'Mint recipient token account, which is encoded as the mint recipient in the CCTP message.',
                'The CCTP Token Messenger Minter program will transfer the amount encoded in the CCTP message',
                'from its custody account to this account.',
                '',
              ],
            },
            {
              name: 'usdc',
              accounts: [
                {
                  name: 'mint',
                  isMut: false,
                  isSigner: false,
                },
              ],
            },
            {
              name: 'tokenProgram',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'systemProgram',
              isMut: false,
              isSigner: false,
            },
          ],
        },
        {
          name: 'matchingEngineCustodian',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'matchingEngineRedeemedFastFill',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'matchingEngineFromEndpoint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'matchingEngineToEndpoint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'matchingEngineLocalCustodyToken',
          isMut: true,
          isSigner: false,
          docs: ['(Matching Engine program).'],
        },
        {
          name: 'matchingEngineProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'consumePreparedFill',
      docs: [
        'This instruction is used to consume a `prepared_fill` account. The tokens are transferred from the',
        '`prepared_custody_token` account to the `dst_token` account. The `prepared_custody_token` account is',
        'closed. This instruction can only be called by the `redeemer` that is saved in the `prepared_fill`.',
        '# Arguments',
        '',
        '* `ctx` - `ConsumePreparedFill` context.',
      ],
      accounts: [
        {
          name: 'redeemer',
          isMut: false,
          isSigner: true,
          docs: ['This signer must be the same one encoded in the prepared fill.'],
        },
        {
          name: 'beneficiary',
          isMut: true,
          isSigner: false,
          docs: [
            'the payer). If someone were to prepare a fill via a redeem fill instruction and he had no',
            'intention of consuming it, he will be out of luck. We will reward the redeemer with the',
            'closed account funds with a payer of his choosing.',
          ],
        },
        {
          name: 'preparedFill',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'dstToken',
          isMut: true,
          isSigner: false,
          docs: [
            'Destination token account, which the redeemer may not own. But because the redeemer is a',
            'signer and is the one encoded in the Deposit Fill message, he may have the tokens be sent',
            'to any account he chooses (this one).',
            '',
          ],
        },
        {
          name: 'preparedCustodyToken',
          isMut: true,
          isSigner: false,
          docs: [
            'Custody token account. This account will be closed at the end of this instruction. It just',
            'acts as a conduit to allow this program to be the transfer initiator in the CCTP message.',
            '',
          ],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'custodian',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'paused',
            docs: ['Boolean indicating whether outbound transfers are paused.'],
            type: 'bool',
          },
          {
            name: 'owner',
            docs: ["Program's owner."],
            type: 'publicKey',
          },
          {
            name: 'pendingOwner',
            type: {
              option: 'publicKey',
            },
          },
          {
            name: 'ownerAssistant',
            docs: ["Program's assistant. Can be used to update the relayer fee and swap rate."],
            type: 'publicKey',
          },
          {
            name: 'pausedSetBy',
            docs: [
              'Indicate who last set the `paused` value. When the program is first initialized, this is set',
              'to the `owner`.',
            ],
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'preparedFill',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'info',
            type: {
              defined: 'PreparedFillInfo',
            },
          },
          {
            name: 'redeemerMessage',
            type: 'bytes',
          },
        ],
      },
    },
    {
      name: 'preparedOrder',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'info',
            type: {
              defined: 'PreparedOrderInfo',
            },
          },
          {
            name: 'redeemerMessage',
            type: 'bytes',
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'PrepareMarketOrderArgs',
      docs: ['Arguments for [prepare_market_order].'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'amountIn',
            docs: ['Amount of tokens to transfer.'],
            type: 'u64',
          },
          {
            name: 'minAmountOut',
            docs: [
              'If provided, minimum amount of tokens to receive in exchange for',
              '[amount_in](Self::amount_in).',
            ],
            type: {
              option: 'u64',
            },
          },
          {
            name: 'targetChain',
            docs: ['The Wormhole chain ID of the network to transfer tokens to.'],
            type: 'u16',
          },
          {
            name: 'redeemer',
            docs: ['The address of the redeeming contract on the target chain.'],
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'redeemerMessage',
            docs: [
              'Arbitrary payload to be sent to the [redeemer](Self::redeemer), which can be used to encode',
              "instructions or data for another network's smart contract.",
            ],
            type: 'bytes',
          },
        ],
      },
    },
    {
      name: 'CctpMessageArgs',
      docs: ['Arguments for [redeem_cctp_fill].'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'encodedCctpMessage',
            docs: ['CCTP message.'],
            type: 'bytes',
          },
          {
            name: 'cctpAttestation',
            docs: ['Attestation of [encoded_cctp_message](Self::encoded_cctp_message).'],
            type: 'bytes',
          },
        ],
      },
    },
    {
      name: 'PreparedFillInfo',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'vaaHash',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'bump',
            type: 'u8',
          },
          {
            name: 'preparedCustodyTokenBump',
            type: 'u8',
          },
          {
            name: 'preparedBy',
            type: 'publicKey',
          },
          {
            name: 'fillType',
            type: {
              defined: 'FillType',
            },
          },
          {
            name: 'sourceChain',
            type: 'u16',
          },
          {
            name: 'orderSender',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'redeemer',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'PreparedOrderInfo',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'preparedCustodyTokenBump',
            type: 'u8',
          },
          {
            name: 'orderSender',
            type: 'publicKey',
          },
          {
            name: 'preparedBy',
            type: 'publicKey',
          },
          {
            name: 'orderType',
            type: {
              defined: 'OrderType',
            },
          },
          {
            name: 'srcToken',
            type: 'publicKey',
          },
          {
            name: 'refundToken',
            type: 'publicKey',
          },
          {
            name: 'targetChain',
            type: 'u16',
          },
          {
            name: 'redeemer',
            type: {
              array: ['u8', 32],
            },
          },
        ],
      },
    },
    {
      name: 'FillType',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Unset',
          },
          {
            name: 'WormholeCctpDeposit',
          },
          {
            name: 'FastFill',
          },
        ],
      },
    },
    {
      name: 'OrderType',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Market',
            fields: [
              {
                name: 'minAmountOut',
                type: {
                  option: 'u64',
                },
              },
            ],
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6002,
      name: 'OwnerOnly',
    },
    {
      code: 6004,
      name: 'OwnerOrAssistantOnly',
    },
    {
      code: 6016,
      name: 'U64Overflow',
    },
    {
      code: 6048,
      name: 'InvalidVaa',
    },
    {
      code: 6068,
      name: 'InvalidDepositMessage',
    },
    {
      code: 6070,
      name: 'InvalidPayloadId',
    },
    {
      code: 6096,
      name: 'InvalidSourceRouter',
    },
    {
      code: 6098,
      name: 'InvalidTargetRouter',
    },
    {
      code: 6100,
      name: 'EndpointDisabled',
    },
    {
      code: 6102,
      name: 'InvalidCctpEndpoint',
    },
    {
      code: 6128,
      name: 'Paused',
    },
    {
      code: 6256,
      name: 'AssistantZeroPubkey',
    },
    {
      code: 6258,
      name: 'ImmutableProgram',
    },
    {
      code: 6514,
      name: 'InvalidNewOwner',
    },
    {
      code: 6516,
      name: 'AlreadyOwner',
    },
    {
      code: 6518,
      name: 'NoTransferOwnershipRequest',
    },
    {
      code: 6520,
      name: 'NotPendingOwner',
    },
    {
      code: 7024,
      name: 'InsufficientAmount',
    },
    {
      code: 7026,
      name: 'MinAmountOutTooHigh',
    },
    {
      code: 7028,
      name: 'InvalidRedeemer',
    },
  ],
};
