import { useRegisterSW } from "virtual:pwa-register/react";
import { Snackbar } from "@connected-repo/ui-mui/feedback/Snackbar";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconRefresh, IconUpdate } from "@connected-repo/ui-mui/kosh/icons";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useState } from "react";

/**
 * Two-stage service-worker update UX.
 *
 * 1. When Workbox flips `needRefresh` we show a snackbar (Update / Later).
 * 2. If the user picks "Later" we replace the snackbar with a persistent,
 *    non-closable top banner. There's no dismiss — Workbox has already
 *    downloaded the new bundle, and staying on the old one after that
 *    point risks state divergence with the backend. The user can defer
 *    only until they navigate or reload; the banner keeps the "Update"
 *    action one tap away wherever they are in the app.
 *
 * Rendered at the RootLayout so it's visible on auth pages too — a
 * new bundle can land while the user is stuck on Login.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [deferred, setDeferred] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleRefresh = async () => {
    setUpdating(true);
    await updateServiceWorker(true);
  };

  const handleLater = () => {
    setDeferred(true);
  };

  if (!needRefresh) return null;

  if (deferred) {
    return (
      <Box
        sx={(theme) => ({
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.snackbar + 2,
        })}
      >
        <Banner
          icon={<IconUpdate fontSize="inherit" />}
          sx={{ borderRadius: 0, alignItems: "center" }}
          action={
            <Button
              size="small"
              variant="contained"
              onClick={handleRefresh}
              disabled={updating}
              startIcon={<IconRefresh />}
            >
              {updating ? "Updating…" : "Update"}
            </Button>
          }
        >
          A new version of Kosh is ready — update to carry on with the latest.
        </Banner>
      </Box>
    );
  }

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ bottom: { xs: 100, sm: 32 } }}
      message="A new version of Kosh is ready"
      action={
        <>
          <Button variant="text" onClick={handleLater} disabled={updating}>
            Later
          </Button>
          <Button variant="text" onClick={handleRefresh} disabled={updating}>
            {updating ? "Updating…" : "Update"}
          </Button>
        </>
      }
    />
  );
}
