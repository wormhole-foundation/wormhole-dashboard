/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/matching_engine.json`.
 */
export type MatchingEngine = {
  address: 'MatchingEngine11111111111111111111111111111';
  metadata: {
    name: 'matchingEngine';
    version: '0.0.0';
    spec: '0.1.0';
    description: 'Example Matching Engine Program';
    repository: 'https://github.com/wormhole-foundation/example-liquidity-layer';
  };
  instructions: [
    {
      name: 'addAuctionHistoryEntry';
      docs: [
        'This instruction is used to add a new entry to the `AuctionHistory` account if there is an',
        '`Auction` with some info. Regardless of whether there is info in this account, the',
        'instruction finishes its operation by closing this auction account. If the history account',
        'is full, this instruction will revert and `create_new_auction_history`` will have to be',
        'called to initialize another history account.',
        '',
        'This mechanism is important for auction participants. The initial offer participant will',
        'pay lamports to create the `Auction` account. This instruction allows him to reclaim some',
        "lamports by closing that account. And the protocol's fee recipient will be able to claim",
        'lamports by closing the empty `Auction` account it creates when he calls any of the',
        '`settle_auction_none_*` instructions.',
        '# Arguments',
        '',
        '* `ctx` - `AddAuctionHistoryEntry` context.'
      ];
      discriminator: [158, 73, 252, 70, 4, 234, 186, 49];
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
          name: 'history';
          docs: [
            "because we will be writing to this account without using Anchor's [AccountsExit]."
          ];
          writable: true;
        },
        {
          name: 'auction';
          writable: true;
        },
        {
          name: 'beneficiary';
          docs: ['was no auction) or the owner of the initial offer token account.'];
          writable: true;
        },
        {
          name: 'beneficiaryToken';
        },
        {
          name: 'systemProgram';
        }
      ];
      args: [];
    },
    {
      name: 'addCctpRouterEndpoint';
      docs: [
        'This instruction is used to add a new Token Router endpoint from a foreign chain. The endpoint',
        'must be CCTP compatible. This instruction can only be called by the `owner` or `owner_assistant`.',
        '# Arguments',
        '',
        '* `ctx`  - `AddCctpRouterEndpoint` context.',
        '* `args` - The `AddCctpRouterEndpointArgs`, see `admin.rs`.'
      ];
      discriminator: [21, 58, 235, 71, 68, 47, 52, 80];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'admin';
          accounts: [
            {
              name: 'ownerOrAssistant';
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
        },
        {
          name: 'routerEndpoint';
          writable: true;
        },
        {
          name: 'localCustodyToken';
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
          name: 'remoteTokenMessenger';
          docs: ['Messenger Minter program).'];
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
              name: 'addCctpRouterEndpointArgs';
            };
          };
        }
      ];
    },
    {
      name: 'addLocalRouterEndpoint';
      docs: [
        'This instruction is used to add a new Local Router endpoint. Local means that the',
        'Token Router program exists on Solana. This instruction can only be called by the',
        '`owner` or `owner_assistant`.',
        '# Arguments',
        '',
        '* `ctx` - `AddLocalRouterEndpoint` context.'
      ];
      discriminator: [198, 42, 183, 17, 125, 218, 182, 136];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'admin';
          accounts: [
            {
              name: 'ownerOrAssistant';
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
        },
        {
          name: 'routerEndpoint';
          writable: true;
        },
        {
          name: 'local';
          accounts: [
            {
              name: 'tokenRouterProgram';
              docs: ['emitter (router endpoint) address.'];
            },
            {
              name: 'tokenRouterEmitter';
            },
            {
              name: 'tokenRouterMintRecipient';
            }
          ];
        },
        {
          name: 'systemProgram';
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
      name: 'closeProposal';
      docs: [
        'This instruction is used to close an existing proposal by closing the proposal account. This',
        'instruction can only be called by the `owner` or `owner_assistant`.',
        '# Arguments',
        '',
        '* `ctx` - `CloseProposal` context.'
      ];
      discriminator: [213, 178, 139, 19, 50, 191, 82, 245];
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
              accounts: [
                {
                  name: 'custodian';
                }
              ];
            }
          ];
        },
        {
          name: 'proposedBy';
          writable: true;
        },
        {
          name: 'proposal';
          writable: true;
        }
      ];
      args: [];
    },
    {
      name: 'completeFastFill';
      docs: [
        'This instruction is used to complete the fast fill after the `fast_fill` VAA has been',
        'emitted. The Token Router program on Solana will invoke this instruction to complete the',
        "fast fill. Tokens will be deposited into the local endpoint's custody account.",
        '# Arguments',
        '',
        '* `ctx` - `CompleteFastFill` context.'
      ];
      discriminator: [113, 252, 68, 134, 84, 61, 113, 203];
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
          name: 'fastFillVaa';
          accounts: [
            {
              name: 'vaa';
            }
          ];
        },
        {
          name: 'redeemedFastFill';
          writable: true;
        },
        {
          name: 'tokenRouterEmitter';
          signer: true;
        },
        {
          name: 'tokenRouterCustodyToken';
          writable: true;
        },
        {
          name: 'path';
          accounts: [
            {
              name: 'fromEndpoint';
              accounts: [
                {
                  name: 'endpoint';
                }
              ];
            },
            {
              name: 'toEndpoint';
              accounts: [
                {
                  name: 'endpoint';
                }
              ];
            }
          ];
        },
        {
          name: 'localCustodyToken';
          writable: true;
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
      name: 'createFirstAuctionHistory';
      docs: [
        'This instruction is used to create the first `AuctionHistory` account, whose PDA is derived',
        'using ID == 0.',
        '# Arguments',
        '',
        '* `ctx` - `CreateFirstAuctionHistory` context.'
      ];
      discriminator: [225, 203, 74, 36, 233, 11, 54, 75];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'firstHistory';
          writable: true;
        },
        {
          name: 'systemProgram';
        }
      ];
      args: [];
    },
    {
      name: 'createNewAuctionHistory';
      docs: [
        'This instruction is used to create a new `AuctionHistory` account. The PDA is derived using',
        'its ID. A new history account can be created only when the current one is full (number of',
        'entries equals the hard-coded max entries).',
        '# Arguments',
        '',
        '* `ctx` - `CreateNewAuctionHistory` context.'
      ];
      discriminator: [63, 157, 83, 157, 231, 58, 207, 227];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'currentHistory';
        },
        {
          name: 'newHistory';
          writable: true;
        },
        {
          name: 'systemProgram';
        }
      ];
      args: [];
    },
    {
      name: 'disableRouterEndpoint';
      docs: [
        'This instruction is used to disable a router endpoint. This instruction does not close the',
        'account, it only sets the `protocol` to `None` and clears the `address` and `mint_recipient`.',
        'This instruction can only be called by the `owner`.',
        '# Arguments',
        '',
        '* `ctx` - `DisableRouterEndpoint` context.'
      ];
      discriminator: [119, 145, 105, 95, 65, 77, 61, 69];
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
        },
        {
          name: 'routerEndpoint';
          accounts: [
            {
              name: 'endpoint';
              writable: true;
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'executeFastOrderCctp';
      docs: [
        'This instruction is used to execute the fast order after the auction period has ended.',
        'It should be executed before the `grace_period` has ended, otherwise the `highest_bidder`',
        'will incur a penalty. Once executed, a CCTP transfer will be sent to the recipient encoded',
        'in the `FastMarketOrder` VAA on the target chain.',
        '# Arguments',
        '',
        '* `ctx` - `ExecuteFastOrderCctp` context.'
      ];
      discriminator: [176, 38, 30, 17, 230, 78, 206, 157];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
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
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
            }
          ];
        },
        {
          name: 'executeOrder';
          accounts: [
            {
              name: 'fastVaa';
              accounts: [
                {
                  name: 'vaa';
                }
              ];
            },
            {
              name: 'activeAuction';
              accounts: [
                {
                  name: 'auction';
                  writable: true;
                },
                {
                  name: 'custodyToken';
                  writable: true;
                },
                {
                  name: 'config';
                },
                {
                  name: 'bestOfferToken';
                  writable: true;
                }
              ];
            },
            {
              name: 'executorToken';
              writable: true;
            },
            {
              name: 'initialOfferToken';
              writable: true;
            }
          ];
        },
        {
          name: 'toRouterEndpoint';
          accounts: [
            {
              name: 'endpoint';
            }
          ];
        },
        {
          name: 'wormhole';
          accounts: [
            {
              name: 'config';
              writable: true;
            },
            {
              name: 'emitterSequence';
              writable: true;
            },
            {
              name: 'feeCollector';
              writable: true;
            },
            {
              name: 'coreBridgeProgram';
            }
          ];
        },
        {
          name: 'cctp';
          accounts: [
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
              docs: [
                'CHECK Seeds must be \\["token_minter"\\] (CCTP Token Messenger Minter program).'
              ];
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
              name: 'tokenMessengerMinterProgram';
            },
            {
              name: 'messageTransmitterProgram';
            }
          ];
        },
        {
          name: 'systemProgram';
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'sysvars';
          accounts: [
            {
              name: 'clock';
              docs: [
                'Wormhole Core Bridge needs the clock sysvar based on its legacy implementation.',
                ''
              ];
            },
            {
              name: 'rent';
              docs: [
                'Wormhole Core Bridge needs the rent sysvar based on its legacy implementation.',
                ''
              ];
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'executeFastOrderLocal';
      docs: [
        'This instruction is used to execute the fast order after the auction period has ended.',
        'It should be executed before the `grace_period` has ended, otherwise the `highest_bidder`',
        'will incur a penalty. Once executed, a `fast_fill` VAA will be emitted.',
        '# Arguments',
        '',
        '* `ctx` - `ExecuteFastOrderLocal` context.'
      ];
      discriminator: [140, 206, 26, 243, 243, 66, 24, 240];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'coreMessage';
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
          name: 'executeOrder';
          accounts: [
            {
              name: 'fastVaa';
              accounts: [
                {
                  name: 'vaa';
                }
              ];
            },
            {
              name: 'activeAuction';
              accounts: [
                {
                  name: 'auction';
                  writable: true;
                },
                {
                  name: 'custodyToken';
                  writable: true;
                },
                {
                  name: 'config';
                },
                {
                  name: 'bestOfferToken';
                  writable: true;
                }
              ];
            },
            {
              name: 'executorToken';
              writable: true;
            },
            {
              name: 'initialOfferToken';
              writable: true;
            }
          ];
        },
        {
          name: 'toRouterEndpoint';
          accounts: [
            {
              name: 'endpoint';
            }
          ];
        },
        {
          name: 'wormhole';
          accounts: [
            {
              name: 'config';
              writable: true;
            },
            {
              name: 'emitterSequence';
              writable: true;
            },
            {
              name: 'feeCollector';
              writable: true;
            },
            {
              name: 'coreBridgeProgram';
            }
          ];
        },
        {
          name: 'localCustodyToken';
          writable: true;
        },
        {
          name: 'systemProgram';
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'sysvars';
          accounts: [
            {
              name: 'clock';
              docs: [
                'Wormhole Core Bridge needs the clock sysvar based on its legacy implementation.',
                ''
              ];
            },
            {
              name: 'rent';
              docs: [
                'Wormhole Core Bridge needs the rent sysvar based on its legacy implementation.',
                ''
              ];
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'improveOffer';
      docs: [
        'This instruction is used to improve an existing auction offer. The `offer_price` must be',
        'greater than the current `offer_price` in the auction. This instruction will revert if the',
        '`offer_price` is less than the current `offer_price`. This instruction can be called by anyone.',
        '# Arguments',
        '',
        '* `ctx`       - `ImproveOffer` context.',
        '* `offer_price` - The fee that the caller is willing to accept in order for fufilling the fast',
        'order. This fee is paid in USDC.'
      ];
      discriminator: [171, 112, 46, 172, 194, 135, 23, 102];
      accounts: [
        {
          name: 'transferAuthority';
          docs: ['The auction participant needs to set approval to this PDA.', ''];
        },
        {
          name: 'activeAuction';
          accounts: [
            {
              name: 'auction';
              writable: true;
            },
            {
              name: 'custodyToken';
              writable: true;
            },
            {
              name: 'config';
            },
            {
              name: 'bestOfferToken';
              writable: true;
            }
          ];
        },
        {
          name: 'offerToken';
        },
        {
          name: 'tokenProgram';
        }
      ];
      args: [
        {
          name: 'offerPrice';
          type: 'u64';
        }
      ];
    },
    {
      name: 'initialize';
      docs: [
        "This instruction is be used to generate the program's `custodian` and `auction_config`",
        'configs. It also reates the `owner` and `fee_recipient` accounts. Finally, it sets the upgrade',
        'authority to the `upgrade_manager_authority`. Upgrades are managed by the `upgrade_manager_program`.',
        '# Arguments',
        '',
        '* `ctx`            - `Initialize` context.',
        '* `auction_params` - The auction parameters, see `auction_config.rs`.'
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
          docs: ['Custodian account, which saves program data useful for other', 'instructions.'];
          writable: true;
        },
        {
          name: 'auctionConfig';
          writable: true;
        },
        {
          name: 'ownerAssistant';
          docs: ['TODO: do we prevent the owner from being the owner assistant?'];
        },
        {
          name: 'feeRecipient';
        },
        {
          name: 'feeRecipientToken';
        },
        {
          name: 'cctpMintRecipient';
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
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'initializeArgs';
            };
          };
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
      name: 'placeInitialOfferCctp';
      docs: [
        'This instruction is used to create a new auction given a valid `FastMarketOrder` vaa. This',
        'instruction will record information about the auction and transfer funds from the payer to',
        'an auction-specific token custody account. This instruction can be called by anyone.',
        '# Arguments',
        '',
        '* `ctx`       - `PlaceInitialOfferCctp` context.',
        '* `offer_price` - The fee that the caller is willing to accept in order for fufilling the fast',
        'order. This fee is paid in USDC.'
      ];
      discriminator: [157, 156, 175, 35, 91, 249, 1, 129];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'transferAuthority';
          docs: ['The auction participant needs to set approval to this PDA.', ''];
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
          name: 'auctionConfig';
        },
        {
          name: 'fastOrderPath';
          accounts: [
            {
              name: 'fastVaa';
              accounts: [
                {
                  name: 'vaa';
                }
              ];
            },
            {
              name: 'path';
              accounts: [
                {
                  name: 'fromEndpoint';
                  accounts: [
                    {
                      name: 'endpoint';
                    }
                  ];
                },
                {
                  name: 'toEndpoint';
                  accounts: [
                    {
                      name: 'endpoint';
                    }
                  ];
                }
              ];
            }
          ];
        },
        {
          name: 'auction';
          docs: [
            'This account should only be created once, and should never be changed to',
            'init_if_needed. Otherwise someone can game an existing auction.'
          ];
          writable: true;
        },
        {
          name: 'offerToken';
        },
        {
          name: 'auctionCustodyToken';
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
          name: 'systemProgram';
        },
        {
          name: 'tokenProgram';
        }
      ];
      args: [
        {
          name: 'offerPrice';
          type: 'u64';
        }
      ];
    },
    {
      name: 'prepareOrderResponseCctp';
      docs: [
        'This instruction is used to prepare the order response for a CCTP transfer. This instruction',
        'will redeem the finalized transfer associated with a particular auction, and deposit the funds',
        'to the `prepared_custody_token` account that is created during execution. This instruction',
        'will create a `PreparedOrderResponse` account that will be used to settle the auction.',
        '# Arguments',
        '',
        '* `ctx` - `PrepareOrderResponseCctp` context.'
      ];
      discriminator: [221, 178, 184, 43, 247, 248, 90, 160];
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
          name: 'fastOrderPath';
          accounts: [
            {
              name: 'fastVaa';
              accounts: [
                {
                  name: 'vaa';
                }
              ];
            },
            {
              name: 'path';
              accounts: [
                {
                  name: 'fromEndpoint';
                  accounts: [
                    {
                      name: 'endpoint';
                    }
                  ];
                },
                {
                  name: 'toEndpoint';
                  accounts: [
                    {
                      name: 'endpoint';
                    }
                  ];
                }
              ];
            }
          ];
        },
        {
          name: 'finalizedVaa';
          accounts: [
            {
              name: 'vaa';
            }
          ];
        },
        {
          name: 'preparedOrderResponse';
          writable: true;
        },
        {
          name: 'preparedCustodyToken';
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
      name: 'proposeAuctionParameters';
      docs: [
        'This instruction is used to propose new auction parameters. A proposal cannot be enacted',
        'until one epoch has passed. This instruction can only be called by the `owner` or',
        '`owner_assistant`.',
        '# Arguments',
        '',
        '* `ctx`    - `ProposeAuctionParameters` context.',
        '* `params` - The new `AuctionParameters`, see `auction_config.rs`.'
      ];
      discriminator: [86, 19, 21, 43, 32, 106, 249, 80];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'admin';
          accounts: [
            {
              name: 'ownerOrAssistant';
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
        },
        {
          name: 'proposal';
          writable: true;
        },
        {
          name: 'systemProgram';
        },
        {
          name: 'epochSchedule';
        }
      ];
      args: [
        {
          name: 'params';
          type: {
            defined: {
              name: 'auctionParameters';
            };
          };
        }
      ];
    },
    {
      name: 'setPause';
      docs: [
        'This instruction is used to pause or unpause further processing of new auctions. Only the `owner`',
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
          name: 'pause';
          type: 'bool';
        }
      ];
    },
    {
      name: 'settleAuctionComplete';
      docs: [
        'This instruction is used to settle the acution after the `FastMarketOrder` has been executed,',
        'and the `PreparedOrderResponse` has been created. This instruction will settle the auction',
        'by transferring the funds from the `prepared_custody_token` account to the `highest_bidder`',
        'account.',
        '# Arguments',
        '',
        '* `ctx` - `SettleAuctionComplete` context.'
      ];
      discriminator: [84, 39, 0, 132, 21, 101, 222, 137];
      accounts: [
        {
          name: 'executor';
          docs: [
            'we will always reward the owner of the executor token account with the lamports from the',
            'prepared order response and its custody token account when we close these accounts. This',
            'means we disregard the `prepared_by` field in the prepared order response.'
          ];
          writable: true;
        },
        {
          name: 'executorToken';
          writable: true;
        },
        {
          name: 'bestOfferToken';
          docs: [
            'Destination token account, which the redeemer may not own. But because the redeemer is a',
            'signer and is the one encoded in the Deposit Fill message, he may have the tokens be sent',
            'to any account he chooses (this one).',
            ''
          ];
          writable: true;
        },
        {
          name: 'preparedOrderResponse';
          writable: true;
        },
        {
          name: 'preparedCustodyToken';
          writable: true;
        },
        {
          name: 'auction';
          writable: true;
        },
        {
          name: 'tokenProgram';
        }
      ];
      args: [];
    },
    {
      name: 'settleAuctionNoneCctp';
      docs: [
        'This instruction is used to route funds to the `recipient` for a `FastMarketOrder` with',
        'no corresponding auction on Solana. This instruction can be called by anyone, but the',
        '`base_fee` associated with relaying a finalized VAA will be paid to the `fee_recipient`.',
        'This instruction generates a `Fill` message.',
        '# Arguments',
        '',
        '* `ctx` - `SettleAuctionNoneCctp` context.'
      ];
      discriminator: [120, 236, 82, 121, 242, 118, 74, 161];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
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
          name: 'custodian';
          accounts: [
            {
              name: 'custodian';
            }
          ];
        },
        {
          name: 'feeRecipientToken';
          docs: [
            'Destination token account, which the redeemer may not own. But because the redeemer is a',
            'signer and is the one encoded in the Deposit Fill message, he may have the tokens be sent',
            'to any account he chooses (this one).',
            ''
          ];
          writable: true;
        },
        {
          name: 'prepared';
          accounts: [
            {
              name: 'by';
              writable: true;
            },
            {
              name: 'orderResponse';
              writable: true;
            },
            {
              name: 'custodyToken';
              writable: true;
            }
          ];
        },
        {
          name: 'auction';
          docs: ['There should be no account data here because an auction was never created.'];
          writable: true;
        },
        {
          name: 'wormhole';
          accounts: [
            {
              name: 'config';
              writable: true;
            },
            {
              name: 'emitterSequence';
              writable: true;
            },
            {
              name: 'feeCollector';
              writable: true;
            },
            {
              name: 'coreBridgeProgram';
            }
          ];
        },
        {
          name: 'cctp';
          accounts: [
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
              docs: [
                'CHECK Seeds must be \\["token_minter"\\] (CCTP Token Messenger Minter program).'
              ];
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
        },
        {
          name: 'sysvars';
          accounts: [
            {
              name: 'clock';
              docs: [
                'Wormhole Core Bridge needs the clock sysvar based on its legacy implementation.',
                ''
              ];
            },
            {
              name: 'rent';
              docs: [
                'Wormhole Core Bridge needs the rent sysvar based on its legacy implementation.',
                ''
              ];
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'settleAuctionNoneLocal';
      docs: [
        'This instruction is used to settle a `FastMarketOrder` with no corresponding auction. The funds',
        'are routed to the `recipient` on the target chain by executing a CCTP transfer and sending a `Fill`',
        'message. This instruction can be called by anyone, but the `base_fee` associated with relaying a',
        'finalized VAA will be paid to the `fee_recipient`.',
        '# Arguments',
        '',
        '* `ctx` - `SettleAuctionNoneLocal` context.'
      ];
      discriminator: [253, 213, 132, 148, 31, 119, 215, 162];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'coreMessage';
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
          name: 'feeRecipientToken';
          docs: [
            'Destination token account, which the redeemer may not own. But because the redeemer is a',
            'signer and is the one encoded in the Deposit Fill message, he may have the tokens be sent',
            'to any account he chooses (this one).',
            ''
          ];
          writable: true;
        },
        {
          name: 'prepared';
          accounts: [
            {
              name: 'by';
              writable: true;
            },
            {
              name: 'orderResponse';
              writable: true;
            },
            {
              name: 'custodyToken';
              writable: true;
            }
          ];
        },
        {
          name: 'auction';
          docs: ['There should be no account data here because an auction was never created.'];
          writable: true;
        },
        {
          name: 'wormhole';
          accounts: [
            {
              name: 'config';
              writable: true;
            },
            {
              name: 'emitterSequence';
              writable: true;
            },
            {
              name: 'feeCollector';
              writable: true;
            },
            {
              name: 'coreBridgeProgram';
            }
          ];
        },
        {
          name: 'localCustodyToken';
          writable: true;
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'systemProgram';
        },
        {
          name: 'sysvars';
          accounts: [
            {
              name: 'clock';
              docs: [
                'Wormhole Core Bridge needs the clock sysvar based on its legacy implementation.',
                ''
              ];
            },
            {
              name: 'rent';
              docs: [
                'Wormhole Core Bridge needs the rent sysvar based on its legacy implementation.',
                ''
              ];
            }
          ];
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
      name: 'updateAuctionParameters';
      docs: [
        'This instruction is used to enact an existing auction update proposal. It can only be',
        'executed after the `slot_enact_delay` has passed. This instruction can only be called by',
        'the `owner` of the proposal.',
        '# Arguments',
        '',
        '* `ctx` - `UpdateAuctionParameters` context.'
      ];
      discriminator: [10, 33, 10, 75, 17, 63, 21, 245];
      accounts: [
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
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
          name: 'proposal';
          writable: true;
        },
        {
          name: 'auctionConfig';
          writable: true;
        },
        {
          name: 'systemProgram';
        }
      ];
      args: [];
    },
    {
      name: 'updateCctpRouterEndpoint';
      docs: [
        'This instruction is used to update a CCTP router endpoint. It allows the caller to change',
        'the `address`, `mint_recipient`, and `domain`. This instruction can only be called by the',
        '`owner`.',
        '# Arguments',
        '',
        '* `ctx`  - `UpdateCctpRouterEndpoint` context.',
        '* `args` - The `AddCctpRouterEndpointArgs`, see `admin.rs`.'
      ];
      discriminator: [34, 122, 31, 38, 73, 126, 94, 127];
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
        },
        {
          name: 'routerEndpoint';
          accounts: [
            {
              name: 'endpoint';
              writable: true;
            }
          ];
        },
        {
          name: 'remoteTokenMessenger';
          docs: ['Messenger Minter program).'];
        }
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'addCctpRouterEndpointArgs';
            };
          };
        }
      ];
    },
    {
      name: 'updateFeeRecipient';
      docs: [
        'This instruction is used to update the `fee_recipient` field in the `Custodian` account. This',
        'instruction can only be called by the `owner` or `owner_assistant`.',
        '# Arguments',
        '',
        '* `ctx` - `UpdateFeeRecipient` context.'
      ];
      discriminator: [249, 0, 198, 35, 183, 123, 57, 188];
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
        },
        {
          name: 'newFeeRecipientToken';
        },
        {
          name: 'newFeeRecipient';
          docs: ['New Fee Recipient.', ''];
        }
      ];
      args: [];
    },
    {
      name: 'updateLocalRouterEndpoint';
      docs: [
        'This instruction is used to update a Local router endpoint. It allows the caller to change',
        'the `address` and `mint_recipient`. This instruction can only be called by the `owner`.',
        '# Arguments',
        '',
        '* `ctx` - `UpdateLocalRouterEndpoint` context.'
      ];
      discriminator: [222, 237, 142, 228, 88, 3, 49, 102];
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
        },
        {
          name: 'routerEndpoint';
          accounts: [
            {
              name: 'endpoint';
              writable: true;
            }
          ];
        },
        {
          name: 'local';
          accounts: [
            {
              name: 'tokenRouterProgram';
              docs: ['emitter (router endpoint) address.'];
            },
            {
              name: 'tokenRouterEmitter';
            },
            {
              name: 'tokenRouterMintRecipient';
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
      name: 'auction';
      discriminator: [218, 94, 247, 242, 126, 233, 131, 81];
    },
    {
      name: 'auctionConfig';
      discriminator: [195, 54, 8, 51, 28, 231, 33, 142];
    },
    {
      name: 'auctionHistory';
      discriminator: [149, 208, 45, 154, 47, 248, 102, 245];
    },
    {
      name: 'auctionHistoryInternal';
      discriminator: [149, 208, 45, 154, 47, 248, 102, 245];
    },
    {
      name: 'custodian';
      discriminator: [132, 228, 139, 184, 112, 228, 108, 240];
    },
    {
      name: 'preparedOrderResponse';
      discriminator: [20, 123, 155, 182, 141, 189, 18, 173];
    },
    {
      name: 'proposal';
      discriminator: [26, 94, 189, 187, 116, 136, 53, 33];
    },
    {
      name: 'redeemedFastFill';
      discriminator: [44, 188, 179, 117, 17, 246, 14, 11];
    },
    {
      name: 'remoteTokenMessenger';
      discriminator: [105, 115, 174, 34, 95, 233, 138, 252];
    },
    {
      name: 'routerEndpoint';
      discriminator: [217, 148, 188, 203, 183, 105, 154, 205];
    }
  ];
  events: [
    {
      name: 'auctionSettled';
      discriminator: [61, 151, 131, 170, 95, 203, 219, 147];
    },
    {
      name: 'auctionUpdated';
      discriminator: [67, 35, 50, 236, 108, 230, 253, 111];
    },
    {
      name: 'enacted';
      discriminator: [200, 226, 146, 0, 188, 24, 141, 143];
    },
    {
      name: 'orderExecuted';
      discriminator: [74, 135, 231, 5, 168, 106, 194, 117];
    },
    {
      name: 'proposed';
      discriminator: [216, 37, 138, 141, 130, 208, 180, 153];
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
      code: 6018;
      name: 'u32Overflow';
    },
    {
      code: 6032;
      name: 'sameEndpoint';
    },
    {
      code: 6034;
      name: 'invalidEndpoint';
    },
    {
      code: 6048;
      name: 'invalidVaa';
    },
    {
      code: 6066;
      name: 'invalidDeposit';
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
      code: 6072;
      name: 'invalidDepositPayloadId';
    },
    {
      code: 6074;
      name: 'notFastMarketOrder';
    },
    {
      code: 6076;
      name: 'vaaMismatch';
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
      code: 6257;
      name: 'feeRecipientZeroPubkey';
    },
    {
      code: 6258;
      name: 'immutableProgram';
    },
    {
      code: 6260;
      name: 'zeroDuration';
    },
    {
      code: 6262;
      name: 'zeroGracePeriod';
    },
    {
      code: 6263;
      name: 'zeroPenaltyPeriod';
    },
    {
      code: 6264;
      name: 'userPenaltyRewardBpsTooLarge';
      msg: 'Value exceeds 1000000';
    },
    {
      code: 6266;
      name: 'initialPenaltyBpsTooLarge';
      msg: 'Value exceeds 1000000';
    },
    {
      code: 6268;
      name: 'minOfferDeltaBpsTooLarge';
      msg: 'Value exceeds 1000000';
    },
    {
      code: 6270;
      name: 'zeroSecurityDepositBase';
    },
    {
      code: 6271;
      name: 'securityDepositBpsTooLarge';
      msg: 'Value exceeds 1000000';
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
      code: 6524;
      name: 'invalidChain';
    },
    {
      code: 6576;
      name: 'chainNotAllowed';
    },
    {
      code: 6578;
      name: 'invalidMintRecipient';
    },
    {
      code: 6768;
      name: 'proposalAlreadyEnacted';
    },
    {
      code: 6770;
      name: 'proposalDelayNotExpired';
    },
    {
      code: 6772;
      name: 'invalidProposal';
    },
    {
      code: 6832;
      name: 'auctionConfigMismatch';
    },
    {
      code: 7024;
      name: 'fastMarketOrderExpired';
    },
    {
      code: 7026;
      name: 'offerPriceTooHigh';
    },
    {
      code: 7030;
      name: 'invalidEmitterForFastFill';
    },
    {
      code: 7032;
      name: 'auctionNotActive';
    },
    {
      code: 7034;
      name: 'auctionPeriodExpired';
    },
    {
      code: 7036;
      name: 'auctionPeriodNotExpired';
    },
    {
      code: 7044;
      name: 'executorTokenMismatch';
    },
    {
      code: 7050;
      name: 'auctionNotCompleted';
    },
    {
      code: 7054;
      name: 'carpingNotAllowed';
    },
    {
      code: 7056;
      name: 'auctionNotSettled';
    },
    {
      code: 7058;
      name: 'executorNotPreparedBy';
    },
    {
      code: 7060;
      name: 'invalidOfferToken';
    },
    {
      code: 7280;
      name: 'cannotCloseAuctionYet';
    },
    {
      code: 7282;
      name: 'auctionHistoryNotFull';
    },
    {
      code: 7284;
      name: 'auctionHistoryFull';
    }
  ];
  types: [
    {
      name: 'addCctpRouterEndpointArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'chain';
            type: 'u16';
          },
          {
            name: 'cctpDomain';
            type: 'u32';
          },
          {
            name: 'address';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'mintRecipient';
            type: {
              option: {
                array: ['u8', 32];
              };
            };
          }
        ];
      };
    },
    {
      name: 'auction';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'vaaHash';
            docs: ['VAA hash of the auction.'];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'vaaTimestamp';
            docs: ['Timestamp of the fast market order VAA.'];
            type: 'u32';
          },
          {
            name: 'targetProtocol';
            docs: ['Transfer protocol used to move assets.'];
            type: {
              defined: {
                name: 'messageProtocol';
              };
            };
          },
          {
            name: 'status';
            docs: ['Auction status.'];
            type: {
              defined: {
                name: 'auctionStatus';
              };
            };
          },
          {
            name: 'info';
            docs: ['Optional auction info. This field will be `None`` if there is no auction.'];
            type: {
              option: {
                defined: {
                  name: 'auctionInfo';
                };
              };
            };
          }
        ];
      };
    },
    {
      name: 'auctionConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'id';
            docs: ['Monotonically increasing identifier for auction configs.'];
            type: 'u32';
          },
          {
            name: 'parameters';
            docs: [
              'Auction parameters, which are validated by [crate::utils::auction::require_valid_parameters].'
            ];
            type: {
              defined: {
                name: 'auctionParameters';
              };
            };
          }
        ];
      };
    },
    {
      name: 'auctionDestinationAssetInfo';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'custodyTokenBump';
            type: 'u8';
          },
          {
            name: 'amountOut';
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'auctionEntry';
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
            name: 'vaaTimestamp';
            type: 'u32';
          },
          {
            name: 'info';
            type: {
              defined: {
                name: 'auctionInfo';
              };
            };
          }
        ];
      };
    },
    {
      name: 'auctionHistory';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'header';
            type: {
              defined: {
                name: 'auctionHistoryHeader';
              };
            };
          },
          {
            name: 'data';
            type: {
              vec: {
                defined: {
                  name: 'auctionEntry';
                };
              };
            };
          }
        ];
      };
    },
    {
      name: 'auctionHistoryHeader';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'id';
            type: 'u64';
          },
          {
            name: 'minTimestamp';
            type: {
              option: 'u32';
            };
          },
          {
            name: 'maxTimestamp';
            type: {
              option: 'u32';
            };
          }
        ];
      };
    },
    {
      name: 'auctionHistoryInternal';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'header';
            type: {
              defined: {
                name: 'auctionHistoryHeader';
              };
            };
          },
          {
            name: 'numEntries';
            type: 'u32';
          }
        ];
      };
    },
    {
      name: 'auctionInfo';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'configId';
            type: 'u32';
          },
          {
            name: 'custodyTokenBump';
            type: 'u8';
          },
          {
            name: 'vaaSequence';
            docs: ['Sequence of the fast market order VAA.'];
            type: 'u64';
          },
          {
            name: 'sourceChain';
            docs: ['The chain where the transfer is initiated.'];
            type: 'u16';
          },
          {
            name: 'bestOfferToken';
            docs: ['The highest bidder of the auction.'];
            type: 'pubkey';
          },
          {
            name: 'initialOfferToken';
            docs: ['The initial bidder of the auction.'];
            type: 'pubkey';
          },
          {
            name: 'startSlot';
            docs: ['The slot when the auction started.'];
            type: 'u64';
          },
          {
            name: 'amountIn';
            docs: [
              'The amount reflecting the amount of assets transferred into the matching engine. This plus',
              'and the security deposit are used to participate in the auction.'
            ];
            type: 'u64';
          },
          {
            name: 'securityDeposit';
            docs: [
              'The additional deposit made by the highest bidder.',
              '',
              'NOTE: This may not be the same denomination as the `amount_in`.'
            ];
            type: 'u64';
          },
          {
            name: 'offerPrice';
            docs: ['The offer price of the auction.'];
            type: 'u64';
          },
          {
            name: 'destinationAssetInfo';
            docs: [
              'If the destination asset is not equal to the asset used for auctions, this will be some',
              'value specifying its custody token bump and amount out.',
              '',
              'NOTE: Because this is an option, the `AuctionDestinationAssetInfo` having some definition while this',
              "field is None will not impact future serialization because the option's serialized value is",
              "zero. Only when there will be other assets will this struct's members have to be carefully",
              'considered.'
            ];
            type: {
              option: {
                defined: {
                  name: 'auctionDestinationAssetInfo';
                };
              };
            };
          }
        ];
      };
    },
    {
      name: 'auctionParameters';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'userPenaltyRewardBps';
            type: 'u32';
          },
          {
            name: 'initialPenaltyBps';
            type: 'u32';
          },
          {
            name: 'duration';
            type: 'u16';
          },
          {
            name: 'gracePeriod';
            docs: [
              '* The grace period of the auction in slots. This is the number of slots the highest bidder\n     * has to execute the fast order before incurring a penalty. About 15 seconds on Avalanche.\n     * This value INCLUDES the `_auctionDuration`.'
            ];
            type: 'u16';
          },
          {
            name: 'penaltyPeriod';
            type: 'u16';
          },
          {
            name: 'minOfferDeltaBps';
            type: 'u32';
          },
          {
            name: 'securityDepositBase';
            docs: [
              'The base security deposit, which will the the additional amount an auction participant must',
              'deposit to participate in an auction.'
            ];
            type: 'u64';
          },
          {
            name: 'securityDepositBps';
            docs: ['Additional security deposit based on the notional of the order amount.'];
            type: 'u32';
          }
        ];
      };
    },
    {
      name: 'auctionSettled';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'auction';
            docs: ['The pubkey of the auction that was settled.'];
            type: 'pubkey';
          },
          {
            name: 'bestOfferToken';
            docs: [
              'If there was an active auction, this pubkey is the best offer token that was paid back.'
            ];
            type: {
              option: 'pubkey';
            };
          },
          {
            name: 'tokenBalanceAfter';
            docs: [
              "Token account's new balance. If there was no auction, this balance will be of the fee",
              'recipient token account.'
            ];
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'auctionStatus';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'notStarted';
          },
          {
            name: 'active';
          },
          {
            name: 'completed';
            fields: [
              {
                name: 'slot';
                type: 'u64';
              },
              {
                name: 'executePenalty';
                type: {
                  option: 'u64';
                };
              }
            ];
          },
          {
            name: 'settled';
            fields: [
              {
                name: 'fee';
                type: 'u64';
              },
              {
                name: 'totalPenalty';
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
      name: 'auctionUpdated';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'configId';
            type: 'u32';
          },
          {
            name: 'auction';
            type: 'pubkey';
          },
          {
            name: 'vaa';
            type: {
              option: 'pubkey';
            };
          },
          {
            name: 'sourceChain';
            type: 'u16';
          },
          {
            name: 'targetProtocol';
            type: {
              defined: {
                name: 'messageProtocol';
              };
            };
          },
          {
            name: 'endSlot';
            type: 'u64';
          },
          {
            name: 'bestOfferToken';
            type: 'pubkey';
          },
          {
            name: 'tokenBalanceBefore';
            type: 'u64';
          },
          {
            name: 'amountIn';
            type: 'u64';
          },
          {
            name: 'totalDeposit';
            type: 'u64';
          },
          {
            name: 'maxOfferPriceAllowed';
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'cctpMessageArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'encodedCctpMessage';
            type: 'bytes';
          },
          {
            name: 'cctpAttestation';
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
            name: 'paused';
            docs: ['Boolean indicating whether inbound auctions are paused.'];
            type: 'bool';
          },
          {
            name: 'pausedSetBy';
            type: 'pubkey';
          },
          {
            name: 'ownerAssistant';
            docs: ["Program's assistant."];
            type: 'pubkey';
          },
          {
            name: 'feeRecipientToken';
            type: 'pubkey';
          },
          {
            name: 'auctionConfigId';
            type: 'u32';
          },
          {
            name: 'nextProposalId';
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'enacted';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'action';
            type: {
              defined: {
                name: 'proposalAction';
              };
            };
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
      name: 'initializeArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'auctionParams';
            type: {
              defined: {
                name: 'auctionParameters';
              };
            };
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
      name: 'orderExecuted';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'auction';
            type: 'pubkey';
          },
          {
            name: 'vaa';
            type: 'pubkey';
          },
          {
            name: 'sourceChain';
            type: 'u16';
          },
          {
            name: 'targetProtocol';
            type: {
              defined: {
                name: 'messageProtocol';
              };
            };
          },
          {
            name: 'penalized';
            type: 'bool';
          }
        ];
      };
    },
    {
      name: 'preparedOrderResponse';
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
                name: 'preparedOrderResponseInfo';
              };
            };
          },
          {
            name: 'toEndpoint';
            type: {
              defined: {
                name: 'endpointInfo';
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
      name: 'preparedOrderResponseInfo';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'fastVaaHash';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'preparedBy';
            type: 'pubkey';
          },
          {
            name: 'fastVaaTimestamp';
            type: 'u32';
          },
          {
            name: 'sourceChain';
            type: 'u16';
          },
          {
            name: 'baseFee';
            type: 'u64';
          },
          {
            name: 'initAuctionFee';
            type: 'u64';
          },
          {
            name: 'sender';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'redeemer';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'amountIn';
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'proposal';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'id';
            type: 'u64';
          },
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'action';
            type: {
              defined: {
                name: 'proposalAction';
              };
            };
          },
          {
            name: 'by';
            type: 'pubkey';
          },
          {
            name: 'owner';
            type: 'pubkey';
          },
          {
            name: 'slotProposedAt';
            type: 'u64';
          },
          {
            name: 'slotEnactDelay';
            type: 'u64';
          },
          {
            name: 'slotEnactedAt';
            type: {
              option: 'u64';
            };
          }
        ];
      };
    },
    {
      name: 'proposalAction';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'none';
          },
          {
            name: 'updateAuctionParameters';
            fields: [
              {
                name: 'id';
                type: 'u32';
              },
              {
                name: 'parameters';
                type: {
                  defined: {
                    name: 'auctionParameters';
                  };
                };
              }
            ];
          }
        ];
      };
    },
    {
      name: 'proposed';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'action';
            type: {
              defined: {
                name: 'proposalAction';
              };
            };
          }
        ];
      };
    },
    {
      name: 'redeemedFastFill';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'vaaHash';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'sequence';
            type: 'u64';
          }
        ];
      };
    },
    {
      name: 'remoteTokenMessenger';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'domain';
            type: 'u32';
          },
          {
            name: 'tokenMessenger';
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
