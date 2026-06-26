// AUTO-GENERATED — do not edit manually.
// Source: https://raw.githubusercontent.com/wormhole-foundation/wormhole/refs/heads/main/guardianset/mainnetv2/canonical_sets/v7.prototxt
// Run:    npm run generate-guardians

package common

import "strings"

var MainnetGuardians = []GuardianEntry{
	{0, "RockawayX", "0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3"},
	{1, "Staked", "0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"},
	{2, "Figment", "0x114De8460193bdf3A2fCf81f86a09765F4762fD1"},
	{3, "ChainodeTech", "0x107A0086b32d7A0977926A205131d8731D39cbEB"},
	{4, "Inotel", "0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"},
	{5, "HashQuark", "0x42579bFFbCF4276E290aB8E4C162bd4052b97970"},
	{6, "Chainlayer", "0x938f104AEb5581293216ce97d771e0CB721221B1"},
	{7, "Chainstack", "0xF3ea0AD4FFB5a178AE4EBc21861651B25BdcbB91"},
	{8, "Liquify", "0x9D16870160e703324D057c3361c34C5beFBa2c34"},
	{9, "Staking Fund", "0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"},
	{10, "MoonletWallet", "0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"},
	{11, "P2P.ORG Validator", "0xf93124b7c738843CBB89E864c862c38cddCccF95"},
	{12, "01Node", "0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"},
	{13, "MCF", "0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"},
	{14, "Firstset", "0xaE565927Bb8dB25CD8Bf3e7BB663D70023e4Ea78"},
	{15, "DSRV", "0x3F851Ad586A47ceF8d04748f33ab0D71395f06b4"},
	{16, "Syncnode", "0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"},
	{17, "Google Cloud", "0x7899cEAB1DC961Dae9defDB7A4f521269a5448FC"},
	{18, "Senseinode", "0x61D9800f9FCb4160FB0C6cf3A0902592bAC2B434"},
}

var guardianIndexMap = map[string]int{
	strings.ToLower("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3"): 0,
	strings.ToLower("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"): 1,
	strings.ToLower("0x114De8460193bdf3A2fCf81f86a09765F4762fD1"): 2,
	strings.ToLower("0x107A0086b32d7A0977926A205131d8731D39cbEB"): 3,
	strings.ToLower("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"): 4,
	strings.ToLower("0x42579bFFbCF4276E290aB8E4C162bd4052b97970"): 5,
	strings.ToLower("0x938f104AEb5581293216ce97d771e0CB721221B1"): 6,
	strings.ToLower("0xF3ea0AD4FFB5a178AE4EBc21861651B25BdcbB91"): 7,
	strings.ToLower("0x9D16870160e703324D057c3361c34C5beFBa2c34"): 8,
	strings.ToLower("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"): 9,
	strings.ToLower("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"): 10,
	strings.ToLower("0xf93124b7c738843CBB89E864c862c38cddCccF95"): 11,
	strings.ToLower("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"): 12,
	strings.ToLower("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"): 13,
	strings.ToLower("0xaE565927Bb8dB25CD8Bf3e7BB663D70023e4Ea78"): 14,
	strings.ToLower("0x3F851Ad586A47ceF8d04748f33ab0D71395f06b4"): 15,
	strings.ToLower("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"): 16,
	strings.ToLower("0x7899cEAB1DC961Dae9defDB7A4f521269a5448FC"): 17,
	strings.ToLower("0x61D9800f9FCb4160FB0C6cf3A0902592bAC2B434"): 18,
}

var guardianIndexToNameMap = map[int]string{
	0:  "RockawayX",
	1:  "Staked",
	2:  "Figment",
	3:  "ChainodeTech",
	4:  "Inotel",
	5:  "HashQuark",
	6:  "Chainlayer",
	7:  "Chainstack",
	8:  "Liquify",
	9:  "Staking Fund",
	10: "MoonletWallet",
	11: "P2P.ORG Validator",
	12: "01Node",
	13: "MCF",
	14: "Firstset",
	15: "DSRV",
	16: "Syncnode",
	17: "Google Cloud",
	18: "Senseinode",
}

func GetGuardianName(addr string) (string, bool) {
	name, ok := guardianIndexToNameMap[guardianIndexMap[strings.ToLower(addr)]]
	return name, ok
}

func GetGuardianIndexToNameMap() map[int]string {
	return guardianIndexToNameMap
}
