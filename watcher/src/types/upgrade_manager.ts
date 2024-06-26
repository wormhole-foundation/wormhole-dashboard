/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/upgrade_manager.json`.
 */
export type UpgradeManager = {
  address: 'commonUpgrademanagerprogramid';
  metadata: {
    name: 'upgradeManager';
    version: '0.0.0';
    spec: '0.1.0';
    description: 'Example Liquidity Layer Upgrade Manager';
    repository: 'https://github.com/wormhole-foundation/example-liquidity-layer';
  };
  instructions: [
    {
      name: 'commitMatchingEngineUpgrade';
      discriminator: [120, 241, 248, 175, 251, 140, 252, 166];
      accounts: [
        {
          name: 'matchingEngineCustodian';
          writable: true;
        },
        {
          name: 'commitUpgrade';
          accounts: [
            {
              name: 'admin';
              accounts: [
                {
                  name: 'owner';
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.'
                  ];
                  signer: true;
                },
                {
                  name: 'upgradeAuthority';
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority."
                  ];
                }
              ];
            },
            {
              name: 'recipient';
              writable: true;
            },
            {
              name: 'receipt';
              writable: true;
            },
            {
              name: 'program';
            },
            {
              name: 'programData';
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'commitTokenRouterUpgrade';
      discriminator: [181, 179, 155, 150, 72, 230, 172, 236];
      accounts: [
        {
          name: 'tokenRouterCustodian';
          writable: true;
        },
        {
          name: 'commitUpgrade';
          accounts: [
            {
              name: 'admin';
              accounts: [
                {
                  name: 'owner';
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.'
                  ];
                  signer: true;
                },
                {
                  name: 'upgradeAuthority';
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority."
                  ];
                }
              ];
            },
            {
              name: 'recipient';
              writable: true;
            },
            {
              name: 'receipt';
              writable: true;
            },
            {
              name: 'program';
            },
            {
              name: 'programData';
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'executeMatchingEngineUpgrade';
      discriminator: [157, 131, 66, 64, 73, 90, 39, 235];
      accounts: [
        {
          name: 'matchingEngineCustodian';
          writable: true;
        },
        {
          name: 'executeUpgrade';
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
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.'
                  ];
                  signer: true;
                },
                {
                  name: 'upgradeAuthority';
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority."
                  ];
                }
              ];
            },
            {
              name: 'receipt';
              writable: true;
            },
            {
              name: 'buffer';
              docs: ['Deployed implementation of liquidity layer.', ''];
              writable: true;
            },
            {
              name: 'programData';
              writable: true;
            },
            {
              name: 'program';
              docs: ['because we cannot set this account to be mutable in that case.'];
              writable: true;
            },
            {
              name: 'bpfLoaderUpgradeableProgram';
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
                    'BPF Loader Upgradeable needs the clock sysvar for its upgrade instruction.',
                    ''
                  ];
                },
                {
                  name: 'rent';
                  docs: [
                    'BPF Loader Upgradeable needs the rent sysvar for its upgrade instruction.',
                    ''
                  ];
                }
              ];
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'executeTokenRouterUpgrade';
      discriminator: [143, 237, 202, 123, 91, 113, 172, 43];
      accounts: [
        {
          name: 'tokenRouterCustodian';
          writable: true;
        },
        {
          name: 'executeUpgrade';
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
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.'
                  ];
                  signer: true;
                },
                {
                  name: 'upgradeAuthority';
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority."
                  ];
                }
              ];
            },
            {
              name: 'receipt';
              writable: true;
            },
            {
              name: 'buffer';
              docs: ['Deployed implementation of liquidity layer.', ''];
              writable: true;
            },
            {
              name: 'programData';
              writable: true;
            },
            {
              name: 'program';
              docs: ['because we cannot set this account to be mutable in that case.'];
              writable: true;
            },
            {
              name: 'bpfLoaderUpgradeableProgram';
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
                    'BPF Loader Upgradeable needs the clock sysvar for its upgrade instruction.',
                    ''
                  ];
                },
                {
                  name: 'rent';
                  docs: [
                    'BPF Loader Upgradeable needs the rent sysvar for its upgrade instruction.',
                    ''
                  ];
                }
              ];
            }
          ];
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: 'upgradeReceipt';
      discriminator: [157, 218, 157, 144, 110, 49, 42, 111];
    }
  ];
  errors: [
    {
      code: 6016;
      name: 'notUpgraded';
    },
    {
      code: 6018;
      name: 'programDataMismatch';
    },
    {
      code: 6020;
      name: 'ownerMismatch';
    }
  ];
  types: [
    {
      name: 'upgradeReceipt';
      docs: [
        'An account which reflects the status of an upgrade after one has been executed. This account',
        'will only exist when an upgrade status is uncommitted.',
        '',
        'NOTE: Please be careful with modifying the schema of this account. If you upgrade a program',
        'without committing, and follow it with an Upgrade Manager program upgrade with a new receipt',
        'serialization, you will have a bad time.'
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'programDataBump';
            type: 'u8';
          },
          {
            name: 'owner';
            type: 'pubkey';
          },
          {
            name: 'status';
            type: {
              defined: {
                name: 'upgradeStatus';
              };
            };
          }
        ];
      };
    },
    {
      name: 'upgradeStatus';
      docs: ['Current state of an upgrade.'];
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'none';
          },
          {
            name: 'uncommitted';
            fields: [
              {
                name: 'buffer';
                type: 'pubkey';
              },
              {
                name: 'slot';
                type: 'u64';
              }
            ];
          }
        ];
      };
    }
  ];
};
