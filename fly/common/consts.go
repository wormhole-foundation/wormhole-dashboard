package common

import (
	"time"
)

const (
	ExpiryDuration          = 30 * time.Hour
	DatabaseCleanUpInterval = 48 * time.Hour

	MessageUpdateBatchSize = 100
)

type GuardianEntry struct {
	Index   int
	Name    string
	Address string
}

var StandbyMainnetGuardians = []GuardianEntry{
	{19, "Google Cloud", "0x68c16a92903c4c74ffddc730582ba53d967d3dac"},
}

// Although there are multiple testnet guardians running, they all use the same key, so it looks like one.
var TestnetGuardians = []GuardianEntry{
	{0, "Testnet", "0x13947Bd48b18E53fdAeEe77F3473391aC727C638"},
}

var DevnetGuardians = []GuardianEntry{
	{0, "guardian-0", "0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe"},
	{1, "guardian-1", "0x88D7D8B32a9105d228100E72dFFe2Fae0705D31c"},
	{2, "guardian-2", "0x58076F561CC62A47087B567C86f986426dFCD000"},
	{3, "guardian-3", "0xBd6e9833490F8fA87c733A183CD076a6cBD29074"},
	{4, "guardian-4", "0xb853FCF0a5C78C1b56D15fCE7a154e6ebe9ED7a2"},
	{5, "guardian-5", "0xAF3503dBD2E37518ab04D7CE78b630F98b15b78a"},
	{6, "guardian-6", "0x785632deA5609064803B1c8EA8bB2c77a6004Bd1"},
	{7, "guardian-7", "0x09a281a698C0F5BA31f158585B41F4f33659e54D"},
	{8, "guardian-8", "0x3178443AB76a60E21690DBfB17f7F59F09Ae3Ea1"},
	{9, "guardian-9", "0x647ec26ae49b14060660504f4DA1c2059E1C5Ab6"},
	{10, "guardian-10", "0x810AC3D8E1258Bd2F004a94Ca0cd4c68Fc1C0611"},
	{11, "guardian-11", "0x80610e96d645b12f47ae5cf4546b18538739e90F"},
	{12, "guardian-12", "0x2edb0D8530E31A218E72B9480202AcBaeB06178d"},
	{13, "guardian-13", "0xa78858e5e5c4705CdD4B668FFe3Be5bae4867c9D"},
	{14, "guardian-14", "0x5Efe3A05Efc62D60e1D19fAeB56A80223CDd3472"},
	{15, "guardian-15", "0xD791b7D32C05aBB1cc00b6381FA0c4928f0c56fC"},
	{16, "guardian-16", "0x14Bc029B8809069093D712A3fd4DfAb31963597e"},
	{17, "guardian-17", "0x246Ab29FC6EBeDf2D392a51ab2Dc5C59d0902A03"},
	{18, "guardian-18", "0x132A84dFD920b35a3D0BA5f7A0635dF298F9033e"},
}
