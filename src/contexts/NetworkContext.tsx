import React, { ReactNode, useContext, useMemo, useState } from "react";

export type Environment = "mainnet" | "testnet" | "devnet";
export type Network = {
  env: Environment;
  endpoint: string;
  name: string;
  logo: string;
};

type NetworkContextValue = {
  currentNetwork: Network;
  setCurrentNetwork: React.Dispatch<React.SetStateAction<Network>>;
};

// https://book.wormhole.com/reference/rpcnodes.html
// https://wormhole.com/security/
export const networkOptions: Network[] = [
  {
    env: "mainnet",
    endpoint: "https://wormhole-v2-mainnet-api.certus.one",
    name: "Jump Crypto",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjMiIGhlaWdodD0iMjEiIHZpZXdCb3g9IjAgMCA2MyAyMSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwXzQ4NzZfNTYzKSI+CjxwYXRoIGQ9Ik01LjUwMTkgNS40MjE2N0g2LjIxMDQ2VjE2LjM3MjlDNi4yMTA0NiAxOC43OTc4IDQuMzUxNjkgMjAuNDMzOSAwLjc3NTM5MSAyMC40MzM5VjE4LjEzMTFDMi4zMTEgMTguMTMxMSAzLjA3ODIgMTcuNDg0OCAzLjA3ODIgMTYuMTcwN1Y1LjQyMTY3SDUuNTAxOVpNMy40MjE3MSAzLjY0MzE0QzMuMjU4NiAzLjQ4NDAzIDMuMTI4OTcgMy4yOTM4OSAzLjA0MDQ2IDMuMDgzOTJDMi45NTE5NiAyLjg3Mzk2IDIuOTA2MzYgMi42NDg0IDIuOTA2MzYgMi40MjA1NEMyLjkwNjM2IDIuMTkyNjkgMi45NTE5NiAxLjk2NzEzIDMuMDQwNDYgMS43NTcxNkMzLjEyODk3IDEuNTQ3MTkgMy4yNTg2IDEuMzU3MDYgMy40MjE3MSAxLjE5Nzk1QzMuNTgwODIgMS4wMzQ4NCAzLjc3MDk2IDAuOTA1MjIgMy45ODA5MyAwLjgxNjcxNkM0LjE5MDkgMC43MjgyMTIgNC40MTY0NyAwLjY4MjYxNyA0LjY0NDMzIDAuNjgyNjE3QzQuODcyMiAwLjY4MjYxNyA1LjA5Nzc2IDAuNzI4MjEyIDUuMzA3NzMgMC44MTY3MTZDNS41MTc3IDAuOTA1MjIgNS43MDc4NCAxLjAzNDg0IDUuODY2OTUgMS4xOTc5NUM2LjAzMDA2IDEuMzU3MDYgNi4xNTk3IDEuNTQ3MTkgNi4yNDgyIDEuNzU3MTZDNi4zMzY3MSAxLjk2NzEzIDYuMzgyMyAyLjE5MjY5IDYuMzgyMyAyLjQyMDU0QzYuMzgyMyAyLjY0ODQgNi4zMzY3MSAyLjg3Mzk2IDYuMjQ4MiAzLjA4MzkyQzYuMTU5NyAzLjI5Mzg5IDYuMDMwMDYgMy40ODQwMyA1Ljg2Njk1IDMuNjQzMTRDNS43MDc4NCAzLjgwNjI0IDUuNTE3NyAzLjkzNTg3IDUuMzA3NzMgNC4wMjQzN0M1LjA5Nzc2IDQuMTEyODggNC44NzIyIDQuMTU4NDcgNC42NDQzMyA0LjE1ODQ3QzQuNDE2NDcgNC4xNTg0NyA0LjE5MDkgNC4xMTI4OCAzLjk4MDkzIDQuMDI0MzdDMy43NzA5NiAzLjkzNTg3IDMuNTgwODIgMy44MDYyNCAzLjQyMTcxIDMuNjQzMTRWMy42NDMxNFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xNS4yNzgxIDUuNDIxODhIMTguNDEwNFYxNS43ODY3SDE1LjI3ODFWMTQuMjcxNEMxNC44MDM5IDE0LjgyMjQgMTQuMjE0MSAxNS4yNjIyIDEzLjU1MDcgMTUuNTU5NEMxMi44ODczIDE1Ljg1NjcgMTIuMTY2NiAxNi4wMDQxIDExLjQzOTcgMTUuOTkxM0M5LjA5NTAxIDE1Ljk5MTMgNy41MzkwNiAxNC41MzcxIDcuNTM5MDYgMTEuODA5NVY1LjQyNDI3SDEwLjY3MjVWMTAuNjE3NEMxMC42NzI1IDEyLjQxMjcgMTEuMzc5OSAxMy4zMjQ3IDEyLjgxNDkgMTMuMzI0N0MxNC4xODkgMTMuMzI0NyAxNS4yNzkzIDEyLjI1MzUgMTUuMjc5MyAxMC4xMzE1TDE1LjI3ODEgNS40MjE4OFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0zNy45NTM5IDkuNDA4NzNWMTUuNzkyOEgzNC44MjI5VjEwLjQ5OTFDMzQuODIyOSA4Ljc2MTIzIDM0LjE1NTggNy44OTI3MSAzMi44MjE3IDcuODkzNTFDMzEuNTI5IDcuODkzNTEgMzAuNDE3MSA4Ljk4Mzg0IDMwLjQxNzEgMTEuMDg1NVYxNS43OTI4SDI3LjI4NDhWMTAuNDk5MUMyNy4yODQ4IDguNzYxMjMgMjYuNjE4MiA3Ljg5MjcxIDI1LjI4NDkgNy44OTM1MUMyMy45OTIyIDcuODkzNTEgMjIuODgwMyA4Ljk4Mzg0IDIyLjg4MDMgMTEuMDg1NVYxNS43OTI4SDE5Ljc0OFY1LjQyNzk4SDIyLjg4MDNWNi45MjI4NUMyMy45MTA4IDUuNzkxODIgMjUuMTIzMyA1LjIyNTcxIDI2LjU1ODMgNS4yMjU3MUMyOC4zNzY0IDUuMjI1NzEgMjkuNTUwNiA1LjkzMzA1IDMwLjA5MzkgNy4zNDc3NEMzMS4yMDYzIDUuOTI5MDYgMzIuNTQgNS4yMTk3MyAzNC4wOTUxIDUuMjE5NzNDMzYuNDk5NyA1LjIxOTczIDM3Ljk1MzkgNi41MTIzMyAzNy45NTM5IDkuNDA4NzNaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNDkuNTk4MiA2LjYzNDU5QzUwLjYwODMgNy42MDQwNSA1MS4xMTM0IDguOTE3IDUxLjExMzQgMTAuNTk1QzUxLjExMzQgMTIuMjczIDUwLjYwODMgMTMuNTg3MSA0OS41OTgyIDE0LjUzNTFDNDguNTg4IDE1LjUwNDUgNDcuMzE0NSAxNS45ODkyIDQ1Ljc1ODYgMTUuOTg5MkM0NC4zODQ1IDE1Ljk4OTIgNDMuMjczIDE1LjU0NDggNDIuNDI0IDE0LjY1NTlWMjAuMjMzM0gzOS4yOTNWNS40MjIxN0g0Mi40MjRWNi41MzY0NUM0My4yNzMgNS42NDgzOCA0NC4zODQ1IDUuMjAzOTQgNDUuNzU4NiA1LjIwMzE0QzQ3LjMxNDUgNS4xOTk1NSA0OC41ODggNS42ODQyOCA0OS41OTgyIDYuNjM0NTlaTTQ3LjgzOTkgMTAuNTk1QzQ3LjgzOTkgOC43MzYyNyA0Ni42ODg1IDcuNTAzNTEgNDUuMTMyNiA3LjUwMzUxQzQzLjU5NyA3LjUwMzUxIDQyLjQyNCA4LjY3NTIzIDQyLjQyNCAxMC41OTVDNDIuNDI0IDEyLjUxNDggNDMuNTk3IDEzLjY4NjUgNDUuMTMyNiAxMy42ODY1QzQ2LjY4ODUgMTMuNjg2NSA0Ny44Mzk5IDEyLjQ1MzcgNDcuODM5OSAxMC41OTVaIiBmaWxsPSJ3aGl0ZSIvPgo8L2c+CjxwYXRoIGQ9Ik02Mi4yMjQ2IDEyLjkyMDlMNjIuMjI0NiAxNS4zNjg2TDUyLjQzMzUgMTUuMzY4Nkw1Mi40MzM1IDEyLjkyMDlMNjIuMjI0NiAxMi45MjA5WiIgZmlsbD0id2hpdGUiLz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfNDg3Nl81NjMiPgo8cmVjdCB3aWR0aD0iNTAuMzM4NyIgaGVpZ2h0PSIxOS43NTA2IiBmaWxsPSJ3aGl0ZSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMC43NzUzOTEgMC42ODM1OTQpIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg==",
  },
  {
    env: "mainnet",
    endpoint: "https://wormhole.inotel.ro",
    name: "inotel",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAiIGhlaWdodD0iMTciIHZpZXdCb3g9IjAgMCA3MCAxNyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI4LjQ2NTcgNC42MTAzNUgyNi4yMDEyVjE0LjY1NzRIMjguNDY1N1Y0LjYxMDM1WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTI4LjU0MjIgMS4zMDY2NEgyNi4xNDQ1VjMuNzQwMjVIMjguNTQyMlYxLjMwNjY0WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTM3LjIzNjggNC45MTA4NEMzNi42NTk2IDQuNTUzNjEgMzUuOTkzNiA0LjM3NSAzNS4yNjA5IDQuMzc1QzM0LjQ2MTcgNC4zNzUgMzMuNzQwMiA0LjU4NzEgMzMuMDk2MyA1LjAwMDE1QzMyLjc0MTEgNS4yMzQ1OCAzMi40MzAzIDUuNTAyNSAzMi4xNjM5IDUuODI2MjNWNC42MDk0M0gzMC4wMjE1VjE0LjY1NjRIMzIuMjg2VjkuMzY1MDFDMzIuMjg2IDguNzg0NTIgMzIuMzk3IDguMjcxMDEgMzIuNjA3OSA3Ljg0NjhDMzIuODE4OCA3LjQyMjU5IDMzLjExODUgNy4wOTg4NiAzMy40ODQ5IDYuODc1NTlDMzMuODUxMiA2LjY1MjMyIDM0LjI1MDggNi41NDA2OSAzNC42ODM3IDYuNTQwNjlDMzUuMTA1NSA2LjU0MDY5IDM1LjQ3MTkgNi42NDExNiAzNS43OTM4IDYuODQyMUMzNi4xMTU3IDcuMDQzMDQgMzYuMzcxIDcuMzIyMTIgMzYuNTQ4NiA3LjY3OTM1QzM2LjczNzMgOC4wMzY1OCAzNi44MjYxIDguNDQ5NjIgMzYuODI2MSA4LjkxODQ4VjE0LjY1NjRIMzkuMDY4NFY4LjQ0OTYyQzM5LjA2ODQgNy42NzkzNSAzOC45MTMgNi45ODcyMiAzOC41OTExIDYuMzczMjRDMzguMjY5MiA1Ljc1OTI1IDM3LjgyNTIgNS4yNjgwNyAzNy4yMzY4IDQuOTEwODRaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNDcuNzI5NiA1LjA3ODI5QzQ2Ljk1MjYgNC42MDk0MyA0Ni4wOTc4IDQuMzc1IDQ1LjE1NDMgNC4zNzVDNDQuMjMyOSA0LjM3NSA0My4zNzgyIDQuNjA5NDMgNDIuNjEyMiA1LjA3ODI5QzQxLjgzNTIgNS41NDcxNSA0MS4yMjQ3IDYuMTgzNDYgNDAuNzgwNiA2Ljk5ODM5QzQwLjMyNTUgNy44MTMzMSA0MC4xMDM1IDguNjk1MjEgNDAuMTAzNSA5LjY1NTI2QzQwLjEwMzUgMTAuNjE1MyA0MC4zMjU1IDExLjQ5NzIgNDAuNzgwNiAxMi4zMDFDNDEuMjI0NyAxMy4xMDQ3IDQxLjg0NjMgMTMuNzQxIDQyLjYxMjIgMTQuMjA5OUM0My4zODkzIDE0LjY3ODggNDQuMjMyOSAxNC45MTMyIDQ1LjE1NDMgMTQuOTEzMkM0Ni4wODY3IDE0LjkxMzIgNDYuOTUyNiAxNC42Nzg4IDQ3LjcyOTYgMTQuMjA5OUM0OC41MDY2IDEzLjc0MSA0OS4xMTcyIDEzLjEwNDcgNDkuNTcyMyAxMi4zMDFDNTAuMDE2MyAxMS40OTcyIDUwLjI0OTQgMTAuNjE1MyA1MC4yNDk0IDkuNjU1MjZDNTAuMjQ5NCA4LjY5NTIxIDUwLjAyNzQgNy44MTMzMSA0OS41NzIzIDYuOTk4MzlDNDkuMTI4MyA2LjE4MzQ2IDQ4LjUxNzcgNS41MzU5OSA0Ny43Mjk2IDUuMDc4MjlaTTQ3LjYxODYgMTEuMjI5M0M0Ny4zNzQ0IDExLjY5ODIgNDcuMDMwMyAxMi4wNjY1IDQ2LjU5NzMgMTIuMzIzM0M0Ni4xNjQ0IDEyLjU5MTIgNDUuNjg3MSAxMi43MjUyIDQ1LjE1NDMgMTIuNzI1MkM0NC42MzI1IDEyLjcyNTIgNDQuMTU1MiAxMi41OTEyIDQzLjczMzQgMTIuMzIzM0M0My4zMDA1IDEyLjA1NTQgNDIuOTY3NSAxMS42ODcgNDIuNzIzMiAxMS4yMjkzQzQyLjQ3OSAxMC43NjA0IDQyLjM1NjkgMTAuMjM1OCA0Mi4zNTY5IDkuNjU1MjZDNDIuMzU2OSA5LjA4NTkzIDQyLjQ3OSA4LjU2MTI1IDQyLjcyMzIgOC4wODEyM0M0Mi45Njc1IDcuNjEyMzcgNDMuMzAwNSA3LjIzMjgyIDQzLjczMzQgNi45NjQ5QzQ0LjE1NTIgNi42OTY5OCA0NC42MzI1IDYuNTUxODUgNDUuMTY1NCA2LjU1MTg1QzQ1LjY5ODIgNi41NTE4NSA0Ni4xNzU1IDYuNjg1ODEgNDYuNTk3MyA2Ljk2NDlDNDcuMDE5MiA3LjIzMjgyIDQ3LjM1MjIgNy42MTIzNyA0Ny42MDc1IDguMDgxMjNDNDcuODUxNyA4LjU1MDA5IDQ3Ljk3MzggOS4wNzQ3NyA0Ny45NzM4IDkuNjU1MjZDNDcuOTk2IDEwLjIzNTggNDcuODYyOCAxMC43NjA0IDQ3LjYxODYgMTEuMjI5M1oiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik01NS4yMDE1IDEyLjYwMzVDNTUuMDM1IDEyLjY5MjggNTQuODQ2MyAxMi43NDg2IDU0LjY0NjUgMTIuNzQ4NkM1NC40MzU2IDEyLjc0ODYgNTQuMjM1OCAxMi42OTI4IDU0LjA2OTMgMTIuNTkyM0M1My45MDI4IDEyLjQ4MDcgNTMuNzU4NSAxMi4zMzU1IDUzLjY1ODYgMTIuMTU2OUM1My41NTg3IDExLjk2NzIgNTMuNTAzMiAxMS43NjYyIDUzLjUwMzIgMTEuNTU0MVY2LjY3NTczSDU1LjE5MDRWNC42MTA1MUg1My41MDMyVjEuNTUxNzZINTEuMjYwOFY0LjYxMDUxSDUwLjAxNzZWNi42NjQ1N0g1MS4yNjA4VjExLjYwOTlDNTEuMjYwOCAxMi4yMDE2IDUxLjQwNTEgMTIuNzM3NCA1MS42ODI3IDEzLjI1MDlDNTEuOTYwMiAxMy43NTMzIDUyLjM0ODcgMTQuMTU1MiA1Mi44MzcxIDE0LjQ1NjZDNTMuMzI1NSAxNC43NTggNTMuODY5NSAxNC45MDMxIDU0LjQ4IDE0LjkwMzFDNTUuMDEyOCAxNC45MDMxIDU1LjUwMTMgMTQuNzkxNSA1NS45NDUzIDE0LjU2ODJDNTYuMzg5MyAxNC4zNDQ5IDU2Ljc2NjcgMTQuMDEgNTcuMDg4NiAxMy41ODU4TDU1LjY0NTYgMTIuMjIzOUM1NS41MjM1IDEyLjM5MTQgNTUuMzc5MSAxMi41MTQyIDU1LjIwMTUgMTIuNjAzNVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik02My44MjExIDUuMDc5NjlDNjMuMDc3NCA0LjYxMDgzIDYyLjI1NTkgNC4zNjUyMyA2MS4zNjc5IDQuMzY1MjNDNjAuNDc5OSA0LjM2NTIzIDU5LjY2OTUgNC41OTk2NiA1OC45MjU4IDUuMDc5NjlDNTguMTgyIDUuNTQ4NTUgNTcuNTkzNyA2LjE5NjAyIDU3LjE2MDggNi45OTk3OEM1Ni43Mjc5IDcuODAzNTQgNTYuNTA1OSA4LjY4NTQ1IDU2LjUwNTkgOS42NDU0OUM1Ni41MDU5IDEwLjYxNjcgNTYuNzI3OSAxMS40OTg2IDU3LjE4MyAxMi4zMDI0QzU3LjYyNyAxMy4xMDYxIDU4LjI0ODYgMTMuNzMxMyA1OS4wMTQ2IDE0LjIwMDFDNTkuNzkxNiAxNC42NjkgNjAuNjQ2NCAxNC45MDM0IDYxLjYwMSAxNC45MDM0QzYyLjM3ODEgMTQuOTAzNCA2My4wOTk2IDE0Ljc0NzEgNjMuNzg3OCAxNC40MzQ2QzY0LjQ3NiAxNC4xMjIgNjUuMDc1NSAxMy42NzU1IDY1LjU5NzIgMTMuMTA2MUw2NC4yMDk2IDExLjYxMDJDNjMuODU0NCAxMS45Nzg2IDYzLjQ1NDggMTIuMjggNjIuOTk5NyAxMi41MTQ1QzYyLjU0NDYgMTIuNzM3NyA2Mi4wNjcyIDEyLjg0OTQgNjEuNTY3NyAxMi44NDk0QzYxLjAxMjcgMTIuODQ5NCA2MC41MTMyIDEyLjcwNDMgNjAuMDgwMiAxMi40MjUyQzU5LjY0NzMgMTIuMTQ2MSA1OS4zMDMyIDExLjc1NTQgNTkuMDQ3OSAxMS4yNjQyQzU4LjkxNDcgMTAuOTk2MyA1OC44MTQ4IDEwLjcwNiA1OC43NDgyIDEwLjQwNDZINjYuMTg1NUM2Ni4xOTY2IDEwLjMzNzYgNjYuMjA3NyAxMC4yNzA2IDY2LjIwNzcgMTAuMjAzN0M2Ni4yMDc3IDEwLjEzNjcgNjYuMjA3NyAxMC4wODA5IDY2LjIwNzcgMTAuMDI1QzY2LjIxODggOS45NDY5MSA2Ni4yMjk5IDkuODc5OTIgNjYuMjI5OSA5LjgxMjk0QzY2LjIyOTkgOS43NDU5NyA2Ni4yMjk5IDkuNjkwMTUgNjYuMjI5OSA5LjYyMzE3QzY2LjIyOTkgOC42NjMxMiA2Ni4wMTkgNy43ODEyMiA2NS41OTcyIDYuOTg4NjJDNjUuMTY0MyA2LjE5NjAyIDY0LjU3NiA1LjU1OTcxIDYzLjgyMTEgNS4wNzk2OVpNNTkuMDE0NiA3Ljk5MzMyQzU5LjI1ODggNy41MTMzIDU5LjU4MDcgNy4xMzM3NCA1OS45OTE0IDYuODU0NjZDNjAuNDAyMiA2LjU3NTU4IDYwLjg1NzMgNi40MzA0NSA2MS4zNDU3IDYuNDMwNDVDNjEuODU2MyA2LjQzMDQ1IDYyLjMxMTQgNi41NzU1OCA2Mi43MzMzIDYuODU0NjZDNjMuMTU1MSA3LjEzMzc0IDYzLjQ3NyA3LjUxMzMgNjMuNzIxMiA3Ljk5MzMyQzYzLjgxIDguMTgzMSA2My44ODc3IDguMzcyODcgNjMuOTQzMiA4LjU3MzgxSDU4Ljc4MTVDNTguODQ4MSA4LjM3Mjg3IDU4LjkyNTggOC4xNzE5MyA1OS4wMTQ2IDcuOTkzMzJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNjkuMjIxNSAxLjMwNjY0SDY2Ljk1N1YxNC42NjkySDY5LjIyMTVWMS4zMDY2NFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xLjM5MTc4IDQuNzMyODRIMTIuMDcwNUMxMi40MDM1IDQuNzMyODQgMTIuNjgxIDQuNDUzNzUgMTIuNjgxIDQuMTE4ODVWMC42MjQ3MjZDMTIuNjgxIDAuMjg5ODI2IDEyLjQwMzUgMC4wMTA3NDIyIDEyLjA3MDUgMC4wMTA3NDIySDEuMzkxNzhDMS4wNTg3NiAwLjAxMDc0MjIgMC43ODEyNSAwLjI4OTgyNiAwLjc4MTI1IDAuNjI0NzI2VjQuMTA3NjlDMC43ODEyNSA0LjQ1Mzc1IDEuMDU4NzYgNC43MzI4NCAxLjM5MTc4IDQuNzMyODRaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIuMDcwNSAxMS40MzA3SDEuMzkxNzhDMS4wNTg3NiAxMS40MzA3IDAuNzgxMjUgMTEuNzA5NyAwLjc4MTI1IDEyLjA0NDZWMTUuNTI3NkMwLjc4MTI1IDE1Ljg2MjUgMS4wNTg3NiAxNi4xNDE2IDEuMzkxNzggMTYuMTQxNkgxMi4wNzA1QzEyLjQwMzUgMTYuMTQxNiAxMi42ODEgMTUuODYyNSAxMi42ODEgMTUuNTI3NlYxMi4wNDQ2QzEyLjY4MSAxMS42OTg2IDEyLjQxNDYgMTEuNDMwNyAxMi4wNzA1IDExLjQzMDdaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTguMjk3MiA1Ljc0OTAySDcuMTMwMDZDNi43OTcwNCA1Ljc0OTAyIDYuNTE5NTMgNi4wMjgxMSA2LjUxOTUzIDYuMzYzMDFWOS44NDU5N0M2LjUxOTUzIDEwLjE4MDkgNi43OTcwNCAxMC40NiA3LjEzMDA2IDEwLjQ2SDE4LjI5NzJDMTguNjMwMiAxMC40NiAxOC45MDc3IDEwLjE4MDkgMTguOTA3NyA5Ljg0NTk3VjYuMzYzMDFDMTguOTA3NyA2LjAyODExIDE4LjYzMDIgNS43NDkwMiAxOC4yOTcyIDUuNzQ5MDJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTYuNTU0NSA0LjczMzI2QzE3Ljg1NDIgNC43MzMyNiAxOC45MDc4IDMuNjczNjggMTguOTA3OCAyLjM2NjYzQzE4LjkwNzggMS4wNTk1OCAxNy44NTQyIDAgMTYuNTU0NSAwQzE1LjI1NDggMCAxNC4yMDEyIDEuMDU5NTggMTQuMjAxMiAyLjM2NjYzQzE0LjIwMTIgMy42NzM2OCAxNS4yNTQ4IDQuNzMzMjYgMTYuNTU0NSA0LjczMzI2WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTE2LjU1NDUgMTYuMjE5NkMxNy44NTQyIDE2LjIxOTYgMTguOTA3OCAxNS4xNiAxOC45MDc4IDEzLjg1M0MxOC45MDc4IDEyLjU0NTkgMTcuODU0MiAxMS40ODYzIDE2LjU1NDUgMTEuNDg2M0MxNS4yNTQ4IDExLjQ4NjMgMTQuMjAxMiAxMi41NDU5IDE0LjIwMTIgMTMuODUzQzE0LjIwMTIgMTUuMTYgMTUuMjU0OCAxNi4yMTk2IDE2LjU1NDUgMTYuMjE5NloiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0zLjEzNDU3IDEwLjQzNzRDNC40MzMzMyAxMC40Mzc0IDUuNDg3ODggOS4zNzY4NCA1LjQ4Nzg4IDguMDcwNzNDNS40ODc4OCA2Ljc2NDYyIDQuNDMzMzMgNS43MDQxIDMuMTM0NTcgNS43MDQxQzEuODM1OCA1LjcxNTI2IDAuNzgxMjUgNi43NzU3OCAwLjc4MTI1IDguMDgxODlDMC43ODEyNSA5LjM4OCAxLjgzNTggMTAuNDM3NCAzLjEzNDU3IDEwLjQzNzRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K",
  },
  {
    env: "mainnet",
    endpoint: "https://wormhole-v2-mainnet-api.mcf.rocks",
    name: "MCF",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCA0OCAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAuODk2IDEyVjAuNDhIMy4zNDRMNy4zNzYgNS4yOTZMMTEuMzkyIDAuNDhIMTMuODU2VjEySDExLjUzNlYzLjkyTDcuMzc2IDguODk2TDMuMiAzLjkzNlYxMkgwLjg5NlpNMjEuODAzOCAxMkMyMS4zNzcxIDEyIDIwLjk4NzggMTEuODk4NyAyMC42MzU4IDExLjY5NkMyMC4yOTQ0IDExLjQ4MjcgMjAuMDE3MSAxMS4yMDUzIDE5LjgwMzggMTAuODY0QzE5LjYwMTEgMTAuNTEyIDE5LjQ5OTggMTAuMTIyNyAxOS40OTk4IDkuNjk2VjIuNzg0QzE5LjQ5OTggMi4zNTczMyAxOS42MDExIDEuOTczMzMgMTkuODAzOCAxLjYzMkMyMC4wMTcxIDEuMjggMjAuMjk0NCAxLjAwMjY3IDIwLjYzNTggMC43OTk5OTlDMjAuOTg3OCAwLjU4NjY2NiAyMS4zNzcxIDAuNDggMjEuODAzOCAwLjQ4SDMwLjk4NzhWMi44SDIyLjM0NzhDMjIuMTc3MSAyLjggMjIuMDQzOCAyLjg0OCAyMS45NDc4IDIuOTQ0QzIxLjg1MTggMy4wMjkzMyAyMS44MDM4IDMuMTYyNjcgMjEuODAzOCAzLjM0NFY5LjEzNkMyMS44MDM4IDkuMzA2NjcgMjEuODUxOCA5LjQ0IDIxLjk0NzggOS41MzZDMjIuMDQzOCA5LjYzMiAyMi4xNzcxIDkuNjggMjIuMzQ3OCA5LjY4SDMwLjk4NzhWMTJIMjEuODAzOFpNMzYuNDQ4IDEyVjAuNDhINDcuMDcyVjIuOEgzOC43ODRWNS4wNzJINDUuNDU2VjcuNDA4SDM4Ljc4NFYxMkgzNi40NDhaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K",
  },
  {
    env: "mainnet",
    endpoint: "https://wormhole-v2-mainnet-api.chainlayer.network",
    name: "ChainLayer",
    logo: "https://wormhole.com/static/chainlayer-6e20d0207f0e732a015540e4aef0d6b5.svg",
  },
  {
    env: "mainnet",
    endpoint: "https://wormhole-v2-mainnet-api.staking.fund",
    name: "Staking Fund",
    logo: "https://wormhole.com/static/stakingfund-102552dce2737668d02b536d075ba3ab.svg",
  },
  {
    env: "mainnet",
    endpoint: "https://wormhole-v2-mainnet.01node.com",
    name: "01NODE",
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCA3OCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQwLjE2NzggNy4yOTM5NUg0My4yMDA4VjE5LjIzMzZINDAuODQ4NEwzNi42MzE4IDEzLjIyNjhWMTkuMjMzNkgzMy41ODRWNy4yOTM5NUgzNS45NTEyTDQwLjE2NzggMTMuMzAwOFY3LjI5Mzk1WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTU1LjIxNjQgMTcuNjk1NUM1NC4wMDMyIDE4Ljg5MzkgNTIuNTIzNyAxOS41MDA1IDUwLjc3NzkgMTkuNTAwNUM0OS4wMzIxIDE5LjUwMDUgNDcuNTM3NyAxOC44OTM5IDQ2LjMzOTMgMTcuNjk1NUM0NS4xMjYxIDE2LjQ5NzEgNDQuNTE5NSAxNS4wMTc2IDQ0LjUxOTUgMTMuMjcxN0M0NC41MTk1IDExLjUyNTkgNDUuMTI2MSAxMC4wNDY0IDQ2LjMzOTMgOC44NDc5OEM0Ny41NTI1IDcuNjQ5NTcgNDkuMDMyMSA3LjA0Mjk3IDUwLjc3NzkgNy4wNDI5N0M1Mi41MjM3IDcuMDQyOTcgNTQuMDE4IDcuNjQ5NTcgNTUuMjE2NCA4Ljg0Nzk4QzU2LjQyOTYgMTAuMDQ2NCA1Ny4wMzYyIDExLjUyNTkgNTcuMDM2MiAxMy4yNzE3QzU3LjAzNjIgMTUuMDE3NiA1Ni40Mjk2IDE2LjQ5NzEgNTUuMjE2NCAxNy42OTU1Wk00OC40Njk4IDE1LjU5NDZDNDkuMDkxMiAxNi4yMDEyIDQ5Ljg0NTggMTYuNTExOSA1MC43Nzc5IDE2LjUxMTlDNTEuNzEgMTYuNTExOSA1Mi40NjQ1IDE2LjIwMTIgNTMuMDg1OSAxNS41OTQ2QzUzLjcwNzMgMTQuOTg4IDU0LjAwMzIgMTQuMjAzOCA1NC4wMDMyIDEzLjI3MTdDNTQuMDAzMiAxMi4zMjQ4IDUzLjY5MjUgMTEuNTU1NSA1My4wODU5IDEwLjk0ODlDNTIuNDY0NSAxMC4zNDIzIDUxLjcxIDEwLjAzMTYgNTAuNzc3OSAxMC4wMzE2QzQ5Ljg0NTggMTAuMDMxNiA0OS4wOTEyIDEwLjM0MjMgNDguNDY5OCAxMC45NDg5QzQ3Ljg0ODQgMTEuNTU1NSA0Ny41NTI1IDEyLjMzOTYgNDcuNTUyNSAxMy4yNzE3QzQ3LjU1MjUgMTQuMjAzOCA0Ny44NjMyIDE0Ljk4OCA0OC40Njk4IDE1LjU5NDZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNjMuMjE5MiA3LjI5Mzk1QzY0Ljg2MTQgNy4yOTM5NSA2Ni4yNTIyIDcuODcwOTYgNjcuMzYxOCA5LjAxMDE5QzY4LjQ3MTUgMTAuMTQ5NCA2OS4wMTg5IDExLjU2OTcgNjkuMDE4OSAxMy4yNzEyQzY5LjAxODkgMTQuOTcyNiA2OC40NzE1IDE2LjM3ODIgNjcuMzYxOCAxNy41MzIyQzY2LjI1MjIgMTguNjcxNCA2NC44NzYyIDE5LjI0ODQgNjMuMjE5MiAxOS4yNDg0SDU4LjM1MTZWNy4yOTM5NUg2My4yMTkyWk02My4yMTkyIDE2LjI4OTRDNjQuMDQ3NyAxNi4yODk0IDY0LjcyODMgMTYuMDA4MyA2NS4yNDYxIDE1LjQ2MDlDNjUuNzYzOSAxNC45MTM1IDY2LjAzMDMgMTQuMTczNyA2Ni4wMzAzIDEzLjI3MTJDNjYuMDMwMyAxMi4zNjg3IDY1Ljc2MzkgMTEuNjI4OSA2NS4yNDYxIDExLjA4MTVDNjQuNzI4MyAxMC41MzQxIDY0LjA0NzcgMTAuMjUzIDYzLjIxOTIgMTAuMjUzSDYxLjUwMjlWMTYuMjg5NEg2My4yMTkyWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTczLjM4MjkgMTYuMzc4Mkg3Ny45OTlWMTkuMjMzNkg3MC4zMjAzVjcuMjkzOTVINzcuOTEwMlYxMC4xNDk0SDczLjM4MjlWMTEuODA2NUg3Ny40OTZWMTQuNjE3Nkg3My4zODI5VjE2LjM3ODJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjIuODg4MSAwSDUuMjk2NjdDMi4zNjcyMyAwIDAgMi4zNjcyMyAwIDUuMjk2NjdWMjIuMTQ4NEMwIDI1LjA3NzggMi4zNjcyMyAyNy40NDUgNS4yOTY2NyAyNy40NDVIMjIuODg4MUMyNS44MTc2IDI3LjQ0NSAyOC4xODQ4IDI1LjA3NzggMjguMTg0OCAyMi4xNDg0VjUuMjk2NjdDMjguMTk5NiAyLjM2NzIzIDI1LjgxNzYgMCAyMi44ODgxIDBaTTEwLjY4MjEgMjAuMTM2MkM3LjE3NTY2IDIwLjEzNjIgNC4zNDk3OCAxNy4zODQzIDQuMzQ5NzggMTMuODAzOUM0LjM0OTc4IDEwLjIyMzUgNy4xOTA0NSA3LjQ3MTU2IDEwLjY4MjEgNy40NzE1NkMxNC4xODg2IDcuNDcxNTYgMTcuMDE0NCAxMC4yMjM1IDE3LjAxNDQgMTMuODAzOUMxNy4wMjkyIDE3LjM4NDMgMTQuMTg4NiAyMC4xMzYyIDEwLjY4MjEgMjAuMTM2MlpNMjIuNjgxIDE5Ljg4NDdIMTkuODk5NVYxMC42NTI1TDE3LjczOTQgMTEuMjQ0M0wxNy4wNTg4IDguODYyMzFMMjAuMjM5OCA3LjcwODI4SDIyLjY4MVYxOS44ODQ3Wk0xMC42ODIxIDEwLjE3OTFDOC42OTk1NiAxMC4xNzkxIDcuMTMxMjcgMTEuNjI5IDcuMTMxMjcgMTMuODAzOUM3LjEzMTI3IDE1Ljk3ODggOC42OTk1NiAxNy40Mjg3IDEwLjY4MjEgMTcuNDI4N0MxMi42NjQ3IDE3LjQyODcgMTQuMjMzIDE1Ljk3ODggMTQuMjMzIDEzLjgwMzlDMTQuMjMzIDExLjYxNDIgMTIuNjc5NSAxMC4xNzkxIDEwLjY4MjEgMTAuMTc5MVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=",
  },
  {
    env: "testnet",
    endpoint: "https://wormhole-v2-testnet-api.certus.one",
    name: "Testnet",
    logo: "",
  },
  {
    env: "devnet",
    endpoint: "http://localhost:7071",
    name: "Devnet",
    logo: "",
  },
];

const defaultNetwork: Network = networkOptions[0];

const NetworkContext = React.createContext<NetworkContextValue>({
  currentNetwork: defaultNetwork,
  setCurrentNetwork: () => {},
});

export const NetworkContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [currentNetwork, setCurrentNetwork] = useState<Network>(defaultNetwork);
  const value = useMemo(
    () => ({ currentNetwork, setCurrentNetwork }),
    [currentNetwork, setCurrentNetwork]
  );
  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
};

export const useNetworkContext = () => {
  return useContext(NetworkContext);
};