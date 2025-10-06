#!/bin/bash

# Fix UV_AboutUs.tsx
sed -i 's/const navigate = useAppStore.*$/\/\/ const navigate = useAppStore(state => state.navigate);/' src/components/views/UV_AboutUs.tsx
sed -i 's/const \[contentLanguage, setContentLanguage\]/const [contentLanguage]/' src/components/views/UV_AboutUs.tsx
sed -i 's/const \[pageLoadedAt, formData\]/const [formData]/' src/components/views/UV_AboutUs.tsx || true
sed -i 's/} catch (error) {/} catch {/' src/components/views/UV_AboutUs.tsx

# Fix UV_AlertManagement.tsx
sed -i 's/import { Link,/import {/' src/components/views/UV_AlertManagement.tsx
sed -i '/^import Link/d' src/components/views/UV_AlertManagement.tsx || true
sed -i 's/, Settings}/}/' src/components/views/UV_AlertManagement.tsx
sed -i 's/const currentUser = useAppStore.*$/\/\/ const currentUser = useAppStore(state => state.authentication_state.current_user);/' src/components/views/UV_AlertManagement.tsx
sed -i 's/const notificationState = useAppStore.*$/\/\/ const notificationState = useAppStore(state => state.notification_state);/' src/components/views/UV_AlertManagement.tsx
sed -i 's/const updateNotificationCounts = useAppStore.*$/\/\/ const updateNotificationCounts = useAppStore(state => state.update_notification_counts);/' src/components/views/UV_AlertManagement.tsx
sed -i 's/\.isLoading/.isPending/g' src/components/views/UV_AlertManagement.tsx

echo "Basic fixes applied"
