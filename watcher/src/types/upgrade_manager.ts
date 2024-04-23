export type UpgradeManager = {
  version: '0.0.0';
  name: 'upgrade_manager';
  instructions: [
    {
      name: 'executeMatchingEngineUpgrade';
      accounts: [
        {
          name: 'matchingEngineCustodian';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'executeUpgrade';
          accounts: [
            {
              name: 'payer';
              isMut: true;
              isSigner: true;
            },
            {
              name: 'admin';
              accounts: [
                {
                  name: 'owner';
                  isMut: false;
                  isSigner: true;
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.'
                  ];
                },
                {
                  name: 'upgradeAuthority';
                  isMut: false;
                  isSigner: false;
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority."
                  ];
                }
              ];
            },
            {
              name: 'receipt';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'buffer';
              isMut: true;
              isSigner: false;
              docs: ['Deployed implementation of liquidity layer.', ''];
            },
            {
              name: 'programData';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'program';
              isMut: true;
              isSigner: false;
              docs: ['because we cannot set this account to be mutable in that case.'];
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
              name: 'sysvars';
              accounts: [
                {
                  name: 'clock';
                  isMut: false;
                  isSigner: false;
                  docs: [
                    'BPF Loader Upgradeable needs the clock sysvar for its upgrade instruction.',
                    ''
                  ];
                },
                {
                  name: 'rent';
                  isMut: false;
                  isSigner: false;
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
      name: 'commitMatchingEngineUpgrade';
      accounts: [
        {
          name: 'matchingEngineCustodian';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'commitUpgrade';
          accounts: [
            {
              name: 'admin';
              accounts: [
                {
                  name: 'owner';
                  isMut: false;
                  isSigner: true;
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.'
                  ];
                },
                {
                  name: 'upgradeAuthority';
                  isMut: false;
                  isSigner: false;
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority."
                  ];
                }
              ];
            },
            {
              name: 'recipient';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'receipt';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'program';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'programData';
              isMut: false;
              isSigner: false;
            }
          ];
        }
      ];
      args: [];
    },
    {
      name: 'executeTokenRouterUpgrade';
      accounts: [
        {
          name: 'tokenRouterCustodian';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'executeUpgrade';
          accounts: [
            {
              name: 'payer';
              isMut: true;
              isSigner: true;
            },
            {
              name: 'admin';
              accounts: [
                {
                  name: 'owner';
                  isMut: false;
                  isSigner: true;
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.'
                  ];
                },
                {
                  name: 'upgradeAuthority';
                  isMut: false;
                  isSigner: false;
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority."
                  ];
                }
              ];
            },
            {
              name: 'receipt';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'buffer';
              isMut: true;
              isSigner: false;
              docs: ['Deployed implementation of liquidity layer.', ''];
            },
            {
              name: 'programData';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'program';
              isMut: true;
              isSigner: false;
              docs: ['because we cannot set this account to be mutable in that case.'];
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
              name: 'sysvars';
              accounts: [
                {
                  name: 'clock';
                  isMut: false;
                  isSigner: false;
                  docs: [
                    'BPF Loader Upgradeable needs the clock sysvar for its upgrade instruction.',
                    ''
                  ];
                },
                {
                  name: 'rent';
                  isMut: false;
                  isSigner: false;
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
      name: 'commitTokenRouterUpgrade';
      accounts: [
        {
          name: 'tokenRouterCustodian';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'commitUpgrade';
          accounts: [
            {
              name: 'admin';
              accounts: [
                {
                  name: 'owner';
                  isMut: false;
                  isSigner: true;
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.'
                  ];
                },
                {
                  name: 'upgradeAuthority';
                  isMut: false;
                  isSigner: false;
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority."
                  ];
                }
              ];
            },
            {
              name: 'recipient';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'receipt';
              isMut: true;
              isSigner: false;
            },
            {
              name: 'program';
              isMut: false;
              isSigner: false;
            },
            {
              name: 'programData';
              isMut: false;
              isSigner: false;
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
            type: 'publicKey';
          },
          {
            name: 'status';
            type: {
              defined: 'UpgradeStatus';
            };
          }
        ];
      };
    }
  ];
  types: [
    {
      name: 'UpgradeStatus';
      docs: ['Current state of an upgrade.'];
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'None';
          },
          {
            name: 'Uncommitted';
            fields: [
              {
                name: 'buffer';
                type: 'publicKey';
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
  errors: [
    {
      code: 6016;
      name: 'NotUpgraded';
    },
    {
      code: 6018;
      name: 'ProgramDataMismatch';
    },
    {
      code: 6020;
      name: 'OwnerMismatch';
    }
  ];
};

export const IDL: UpgradeManager = {
  version: '0.0.0',
  name: 'upgrade_manager',
  instructions: [
    {
      name: 'executeMatchingEngineUpgrade',
      accounts: [
        {
          name: 'matchingEngineCustodian',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'executeUpgrade',
          accounts: [
            {
              name: 'payer',
              isMut: true,
              isSigner: true,
            },
            {
              name: 'admin',
              accounts: [
                {
                  name: 'owner',
                  isMut: false,
                  isSigner: true,
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.',
                  ],
                },
                {
                  name: 'upgradeAuthority',
                  isMut: false,
                  isSigner: false,
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority.",
                  ],
                },
              ],
            },
            {
              name: 'receipt',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'buffer',
              isMut: true,
              isSigner: false,
              docs: ['Deployed implementation of liquidity layer.', ''],
            },
            {
              name: 'programData',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'program',
              isMut: true,
              isSigner: false,
              docs: ['because we cannot set this account to be mutable in that case.'],
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
              name: 'sysvars',
              accounts: [
                {
                  name: 'clock',
                  isMut: false,
                  isSigner: false,
                  docs: [
                    'BPF Loader Upgradeable needs the clock sysvar for its upgrade instruction.',
                    '',
                  ],
                },
                {
                  name: 'rent',
                  isMut: false,
                  isSigner: false,
                  docs: [
                    'BPF Loader Upgradeable needs the rent sysvar for its upgrade instruction.',
                    '',
                  ],
                },
              ],
            },
          ],
        },
      ],
      args: [],
    },
    {
      name: 'commitMatchingEngineUpgrade',
      accounts: [
        {
          name: 'matchingEngineCustodian',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'commitUpgrade',
          accounts: [
            {
              name: 'admin',
              accounts: [
                {
                  name: 'owner',
                  isMut: false,
                  isSigner: true,
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.',
                  ],
                },
                {
                  name: 'upgradeAuthority',
                  isMut: false,
                  isSigner: false,
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority.",
                  ],
                },
              ],
            },
            {
              name: 'recipient',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'receipt',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'program',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'programData',
              isMut: false,
              isSigner: false,
            },
          ],
        },
      ],
      args: [],
    },
    {
      name: 'executeTokenRouterUpgrade',
      accounts: [
        {
          name: 'tokenRouterCustodian',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'executeUpgrade',
          accounts: [
            {
              name: 'payer',
              isMut: true,
              isSigner: true,
            },
            {
              name: 'admin',
              accounts: [
                {
                  name: 'owner',
                  isMut: false,
                  isSigner: true,
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.',
                  ],
                },
                {
                  name: 'upgradeAuthority',
                  isMut: false,
                  isSigner: false,
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority.",
                  ],
                },
              ],
            },
            {
              name: 'receipt',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'buffer',
              isMut: true,
              isSigner: false,
              docs: ['Deployed implementation of liquidity layer.', ''],
            },
            {
              name: 'programData',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'program',
              isMut: true,
              isSigner: false,
              docs: ['because we cannot set this account to be mutable in that case.'],
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
              name: 'sysvars',
              accounts: [
                {
                  name: 'clock',
                  isMut: false,
                  isSigner: false,
                  docs: [
                    'BPF Loader Upgradeable needs the clock sysvar for its upgrade instruction.',
                    '',
                  ],
                },
                {
                  name: 'rent',
                  isMut: false,
                  isSigner: false,
                  docs: [
                    'BPF Loader Upgradeable needs the rent sysvar for its upgrade instruction.',
                    '',
                  ],
                },
              ],
            },
          ],
        },
      ],
      args: [],
    },
    {
      name: 'commitTokenRouterUpgrade',
      accounts: [
        {
          name: 'tokenRouterCustodian',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'commitUpgrade',
          accounts: [
            {
              name: 'admin',
              accounts: [
                {
                  name: 'owner',
                  isMut: false,
                  isSigner: true,
                  docs: [
                    'Owner of this program. Must match the upgrade authority in this program data.',
                  ],
                },
                {
                  name: 'upgradeAuthority',
                  isMut: false,
                  isSigner: false,
                  docs: [
                    "Engine). This address must equal the liquidity layer program data's upgrade authority.",
                  ],
                },
              ],
            },
            {
              name: 'recipient',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'receipt',
              isMut: true,
              isSigner: false,
            },
            {
              name: 'program',
              isMut: false,
              isSigner: false,
            },
            {
              name: 'programData',
              isMut: false,
              isSigner: false,
            },
          ],
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'upgradeReceipt',
      docs: [
        'An account which reflects the status of an upgrade after one has been executed. This account',
        'will only exist when an upgrade status is uncommitted.',
        '',
        'NOTE: Please be careful with modifying the schema of this account. If you upgrade a program',
        'without committing, and follow it with an Upgrade Manager program upgrade with a new receipt',
        'serialization, you will have a bad time.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'bump',
            type: 'u8',
          },
          {
            name: 'programDataBump',
            type: 'u8',
          },
          {
            name: 'owner',
            type: 'publicKey',
          },
          {
            name: 'status',
            type: {
              defined: 'UpgradeStatus',
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'UpgradeStatus',
      docs: ['Current state of an upgrade.'],
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'None',
          },
          {
            name: 'Uncommitted',
            fields: [
              {
                name: 'buffer',
                type: 'publicKey',
              },
              {
                name: 'slot',
                type: 'u64',
              },
            ],
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6016,
      name: 'NotUpgraded',
    },
    {
      code: 6018,
      name: 'ProgramDataMismatch',
    },
    {
      code: 6020,
      name: 'OwnerMismatch',
    },
  ],
};
