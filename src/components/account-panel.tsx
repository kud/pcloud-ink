import React from "react"
import { Box } from "ink"
import { KeyValue, Panel, ProgressBar } from "@kud/ink-ui"
import { formatBytes, type PCloudUserInfo } from "@kud/pcloud-sdk"

export type AccountPanelProps = {
  user: PCloudUserInfo
  title?: string
}

export const AccountPanel = ({
  user,
  title = "Account",
}: AccountPanelProps) => {
  const used = user.usedquota ?? 0
  const total = user.quota ?? 0
  const percent = total ? Math.round((used / total) * 100) : 0

  return (
    <Panel title={title}>
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <KeyValue label="Email" value={user.email} />
          <KeyValue label="Plan" value={String(user.plan)} />
          <KeyValue
            label="Storage"
            value={`${formatBytes(used)} / ${formatBytes(total)} (${percent}%)`}
          />
        </Box>
        <ProgressBar value={percent} />
      </Box>
    </Panel>
  )
}
