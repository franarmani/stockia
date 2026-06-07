const fs = require('fs');
const file = 'src/components/layout/AppShellLauncher.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { useMusicStore } from '@/stores/useMusicStore'\\nimport { useSubscription } from '@/features/subscription'",
  "import { useMusicStore } from '@/stores/useMusicStore'\nimport { useSubscription } from '@/features/subscription'"
);

content = content.replace(
  "import SubscriptionBanner from '@/features/subscription/components/SubscriptionBanner'\\nimport TrialExpiredModal from '@/components/TrialExpiredModal'",
  "import SubscriptionBanner from '@/features/subscription/components/SubscriptionBanner'\nimport TrialExpiredModal from '@/components/TrialExpiredModal'"
);

content = content.replace(
  "useMusicStore()\\n  const { expiresToday, isExpired } = useSubscription()",
  "useMusicStore()\n  const { expiresToday, isExpired } = useSubscription()"
);

// We need to add it to POS return as well
const posReturn = `        </main>
        <MiniPlayer />
        <YouTubePlayer />
      </div>
    )
  }`;

const posReturnWithModal = `        </main>
        <MiniPlayer />
        <YouTubePlayer />
        {(expiresToday || isExpired) && <TrialExpiredModal />}
      </div>
    )
  }`;

content = content.replace(posReturn, posReturnWithModal);
content = content.replace(posReturn.replace(/\n/g, '\r\n'), posReturnWithModal.replace(/\n/g, '\r\n'));

fs.writeFileSync(file, content);
console.log('Fixed syntax and added to POS');
