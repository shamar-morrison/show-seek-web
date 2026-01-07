# Favorite People Implementation Guide for Next.js Web App

This document outlines how to implement the favorite people feature in your Next.js web app to ensure seamless cross-platform compatibility with your existing React Native mobile app.

---

## Overview

The favorite people feature allows users to save their favorite actors, directors, and other industry professionals. The implementation must maintain consistency between the mobile and web platforms by sharing the same Firestore data structure.

---

## Current Mobile Implementation Analysis

### Firestore Data Structure
```
users/{userId}/favorite_persons/{personId}
```

**Document Structure:**
```typescript
{
  id: number,              // TMDB person ID
  name: string,            // Person's full name
  profile_path: string | null,  // TMDB profile image path
  known_for_department: string, // e.g., "Acting", "Directing"
  addedAt: number          // Unix timestamp (milliseconds)
}
```

### Key Points
- ✅ **Already deployed**: Mobile app is actively using this structure
- ✅ **Firestore rules exist**: Security rules are defined (lines 117-125 in `firestore.rules`)
- ✅ **Service pattern**: Mobile uses `FavoritePersonsService` singleton class
- ✅ **Real-time sync**: Uses Firestore `onSnapshot` for live updates

---

## Next.js Implementation Plan

### 1. Firebase Client Configuration

#### Create Firebase Config (if not exists)
**Path:** `lib/firebase/config.ts`

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
```

> [!IMPORTANT]
> Use the **exact same Firebase project** as the mobile app to ensure data synchronization.

---

### 2. Type Definitions

#### Create Type Definition
**Path:** `lib/firebase/types.ts` or `types/favorite-person.ts`

```typescript
/**
 * Represents a favorited person record
 * Stored at: users/{userId}/favorite_persons/{personId}
 * 
 * IMPORTANT: This structure MUST match the mobile app exactly
 */
export interface FavoritePerson {
  /** TMDB person ID */
  id: number;
  /** Person's full name */
  name: string;
  /** Path to profile image (from TMDB) */
  profile_path: string | null;
  /** Primary department (e.g., "Acting", "Directing") */
  known_for_department: string;
  /** Timestamp when person was favorited (Unix milliseconds) */
  addedAt: number;
}
```

---

### 3. Firebase Service Layer

#### Create Favorite People Service
**Path:** `lib/firebase/favorite-people.ts`

```typescript
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './config';
import { FavoritePerson } from './types';

class FavoritePersonsService {
  /**
   * Get reference to a specific favorite person document
   */
  private getUserFavoritePersonRef(userId: string, personId: string) {
    return doc(db, 'users', userId, 'favorite_persons', personId);
  }

  /**
   * Get reference to the favorite persons collection
   */
  private getUserFavoritePersonsCollection(userId: string) {
    return collection(db, 'users', userId, 'favorite_persons');
  }

  /**
   * Subscribe to all favorite persons for the current user
   * Returns unsubscribe function
   */
  subscribeToFavoritePersons(
    callback: (persons: FavoritePerson[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const user = auth.currentUser;
    
    if (!user) {
      console.warn('[FavoritePersons] No authenticated user');
      return () => {}; // Return no-op unsubscribe
    }

    const personsRef = this.getUserFavoritePersonsCollection(user.uid);
    const q = query(personsRef, orderBy('addedAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const persons: FavoritePerson[] = snapshot.docs.map((doc) => ({
          id: Number(doc.id),
          ...doc.data(),
        })) as FavoritePerson[];

        callback(persons);
      },
      (error) => {
        console.error('[FavoritePersons] Subscription error:', error);
        if (onError) {
          onError(error);
        }
        // Fallback to empty array on error
        callback([]);
      }
    );
  }

  /**
   * Add a person to favorites
   */
  async addFavoritePerson(personData: Omit<FavoritePerson, 'addedAt'>): Promise<void> {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Please sign in to continue');
    }

    const personRef = this.getUserFavoritePersonRef(user.uid, personData.id.toString());

    const favoriteData: FavoritePerson = {
      ...personData,
      addedAt: Date.now(), // IMPORTANT: Use Date.now() for consistency with mobile
    };

    try {
      await setDoc(personRef, favoriteData);
    } catch (error) {
      console.error('[FavoritePersons] addFavoritePerson error:', error);
      throw error;
    }
  }

  /**
   * Remove a person from favorites
   */
  async removeFavoritePerson(personId: number): Promise<void> {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Please sign in to continue');
    }

    const personRef = this.getUserFavoritePersonRef(user.uid, personId.toString());

    try {
      await deleteDoc(personRef);
    } catch (error) {
      console.error('[FavoritePersons] removeFavoritePerson error:', error);
      throw error;
    }
  }

  /**
   * Check if a person is favorited (one-time read)
   */
  async isPersonFavorited(personId: number): Promise<boolean> {
    const user = auth.currentUser;
    
    if (!user) return false;

    try {
      const personRef = this.getUserFavoritePersonRef(user.uid, personId.toString());
      const snapshot = await getDoc(personRef);
      return snapshot.exists();
    } catch (error) {
      console.error('[FavoritePersons] isPersonFavorited error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const favoritePersonsService = new FavoritePersonsService();
```

---

### 4. React Hooks for State Management

#### Create Custom Hooks
**Path:** `hooks/use-favorite-people.ts`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context'; // Your auth context
import { favoritePersonsService } from '@/lib/firebase/favorite-people';
import { FavoritePerson } from '@/lib/firebase/types';

/**
 * Hook to get all favorite persons with real-time updates
 */
export function useFavoritePersons() {
  const { user } = useAuth();
  const [persons, setPersons] = useState<FavoritePerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setPersons([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = favoritePersonsService.subscribeToFavoritePersons(
      (data) => {
        setPersons(data);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { persons, isLoading, error };
}

/**
 * Hook to check if a specific person is favorited
 */
export function useIsPersonFavorited(personId: number) {
  const { persons, isLoading } = useFavoritePersons();

  const isFavorited = persons.some((person) => person.id === personId);

  return { isFavorited, isLoading };
}

/**
 * Hook to get favorite person mutations (add/remove)
 */
export function useFavoritePersonMutations() {
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const addFavoritePerson = async (personData: Omit<FavoritePerson, 'addedAt'>) => {
    setIsAdding(true);
    try {
      await favoritePersonsService.addFavoritePerson(personData);
    } finally {
      setIsAdding(false);
    }
  };

  const removeFavoritePerson = async (personId: number) => {
    setIsRemoving(true);
    try {
      await favoritePersonsService.removeFavoritePerson(personId);
    } finally {
      setIsRemoving(false);
    }
  };

  return {
    addFavoritePerson,
    removeFavoritePerson,
    isAdding,
    isRemoving,
  };
}
```

---

### 5. UI Components

#### Favorite Button Component
**Path:** `components/favorite-person-button.tsx`

```tsx
'use client';

import { useIsPersonFavorited, useFavoritePersonMutations } from '@/hooks/use-favorite-people';
import { FavoritePerson } from '@/lib/firebase/types';
import { Heart } from 'lucide-react';
import { useState } from 'react';

interface FavoritePersonButtonProps {
  person: {
    id: number;
    name: string;
    profile_path: string | null;
    known_for_department: string;
  };
}

export function FavoritePersonButton({ person }: FavoritePersonButtonProps) {
  const { isFavorited, isLoading } = useIsPersonFavorited(person.id);
  const { addFavoritePerson, removeFavoritePerson, isAdding, isRemoving } = useFavoritePersonMutations();
  const [optimisticFavorited, setOptimisticFavorited] = useState(false);

  const handleToggleFavorite = async () => {
    // Optimistic update
    const newState = !isFavorited;
    setOptimisticFavorited(newState);

    try {
      if (isFavorited) {
        await removeFavoritePerson(person.id);
      } else {
        await addFavoritePerson({
          id: person.id,
          name: person.name,
          profile_path: person.profile_path,
          known_for_department: person.known_for_department,
        });
      }
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticFavorited(!newState);
      console.error('Failed to toggle favorite:', error);
    }
  };

  const isActive = isFavorited || optimisticFavorited;
  const isProcessing = isAdding || isRemoving || isLoading;

  return (
    <button
      onClick={handleToggleFavorite}
      disabled={isProcessing}
      className={`
        p-2 rounded-full transition-all
        ${isActive ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}
        ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}
      `}
      aria-label={isActive ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        className={`w-5 h-5 ${isActive ? 'fill-current' : ''}`}
      />
    </button>
  );
}
```

#### Favorite People List Component
**Path:** `components/favorite-people-list.tsx`

```tsx
'use client';

import { useFavoritePersons } from '@/hooks/use-favorite-people';
import Image from 'next/image';
import Link from 'next/link';

export function FavoritePeopleList() {
  const { persons, isLoading, error } = useFavoritePersons();

  if (isLoading) {
    return <div>Loading favorite people...</div>;
  }

  if (error) {
    return <div>Error loading favorites: {error.message}</div>;
  }

  if (persons.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No favorite people yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {persons.map((person) => (
        <Link
          key={person.id}
          href={`/person/${person.id}`}
          className="group"
        >
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200">
            {person.profile_path ? (
              <Image
                src={`https://image.tmdb.org/t/p/w342${person.profile_path}`}
                alt={person.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400">No Image</span>
              </div>
            )}
          </div>
          <h3 className="mt-2 font-medium text-sm">{person.name}</h3>
          <p className="text-xs text-gray-500">{person.known_for_department}</p>
        </Link>
      ))}
    </div>
  );
}
```

---

## Critical Cross-Platform Considerations

### 1. Data Consistency

| Aspect | Implementation |
|--------|----------------|
| **Document Path** | `users/{userId}/favorite_persons/{personId}` |
| **Document ID** | MUST be person ID as string (e.g., `"123456"`) |
| **Timestamp Format** | `Date.now()` (Unix milliseconds, NOT Firestore serverTimestamp) |
| **Field Names** | Exact snake_case match: `profile_path`, `known_for_department` |

> [!WARNING]
> **Do NOT use `serverTimestamp()`** for `addedAt`. The mobile app uses `Date.now()`, and mixing timestamp types will cause sorting inconsistencies.

### 2. Authentication State

```typescript
// Ensure auth state is ready before showing UI
const { user, loading } = useAuth();

if (loading) {
  return <LoadingSpinner />;
}

if (!user) {
  return <SignInPrompt />;
}

// Now safe to show favorite people features
```

### 3. Error Handling

```typescript
try {
  await favoritePersonsService.addFavoritePerson(personData);
  toast.success('Added to favorites');
} catch (error) {
  if (error.code === 'permission-denied') {
    toast.error('Please sign in to add favorites');
  } else if (error.code === 'unavailable') {
    toast.error('Network error. Please try again.');
  } else {
    toast.error('Failed to add to favorites');
  }
}
```

---

## Security Rules Validation

The existing Firestore rules (lines 117-125) already support this feature:

```javascript
match /favorite_persons/{personId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId)
    && request.resource.data.keys().hasAll(['id', 'name', 'addedAt'])
    && request.resource.data.id is int
    && request.resource.data.name is string
    && request.resource.data.addedAt is int;
  allow delete: if isOwner(userId);
}
```

**What this ensures:**
- ✅ Users can only access their own favorites
- ✅ Required fields are enforced: `id`, `name`, `addedAt`
- ✅ Type validation: `id` is integer, `addedAt` is integer
- ✅ Users can delete their own favorites

> [!NOTE]
> The rules are lenient on optional fields (`profile_path`, `known_for_department`), which is fine for flexibility.

---

## Testing Cross-Platform Sync

### Test Checklist

- [ ] **Add from mobile** → Verify appears on web (real-time)
- [ ] **Add from web** → Verify appears on mobile (real-time)
- [ ] **Remove from mobile** → Verify removed on web (real-time)
- [ ] **Remove from web** → Verify removed on mobile (real-time)
- [ ] **Sorting consistency** → Same order on both platforms (newest first)
- [ ] **Offline behavior** → Mobile adds offline, web sees it when mobile reconnects
- [ ] **Sign out/in** → Favorites persist correctly

### Testing Script

```typescript
// Run this in browser console on web app and mobile debugger
import { favoritePersonsService } from '@/lib/firebase/favorite-people';

// Test add
await favoritePersonsService.addFavoritePerson({
  id: 287,
  name: 'Brad Pitt',
  profile_path: '/cckcYc2v0yh1tc9QjRelptcOBko.jpg',
  known_for_department: 'Acting',
});

// Test remove
await favoritePersonsService.removeFavoritePerson(287);
```

---

## Common Pitfalls to Avoid

| ❌ Don't | ✅ Do |
|---------|-------|
| Use `serverTimestamp()` for `addedAt` | Use `Date.now()` |
| Use camelCase field names | Use snake_case (`profile_path`, `known_for_department`) |
| Store person ID as number in document path | Store as string (`.toString()`) |
| Forget to unsubscribe from listeners | Always call unsubscribe in useEffect cleanup |
| Mix Firestore Timestamp and Unix timestamps | Consistently use Unix milliseconds |

---

## Performance Optimizations

### 1. Pagination for Large Lists

If a user has 100+ favorites, consider pagination:

```typescript
const q = query(
  personsRef,
  orderBy('addedAt', 'desc'),
  limit(20)
);

// For infinite scroll:
const lastDoc = snapshot.docs[snapshot.docs.length - 1];
const nextQuery = query(
  personsRef,
  orderBy('addedAt', 'desc'),
  startAfter(lastDoc),
  limit(20)
);
```

### 2. Image Loading

```tsx
<Image
  src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
  alt={person.name}
  loading="lazy"
  placeholder="blur"
  blurDataURL="/placeholder.jpg"
/>
```

### 3. Debounce Rapid Toggles

```typescript
import { debounce } from 'lodash';

const debouncedToggle = debounce(async (personId: number, isFavorited: boolean) => {
  if (isFavorited) {
    await removeFavoritePerson(personId);
  } else {
    await addFavoritePerson(personData);
  }
}, 300);
```

---

## Deployment Checklist

- [ ] Environment variables configured (`.env.local`)
- [ ] Firebase project ID matches mobile app
- [ ] Firestore security rules deployed
- [ ] Auth state properly initialized
- [ ] Error boundaries implemented
- [ ] Loading states handled
- [ ] Offline behavior tested
- [ ] Cross-platform sync verified

---

## Next Steps

1. **Set up Firebase config** in Next.js project
2. **Copy type definitions** from mobile app
3. **Implement service layer** with exact method signatures
4. **Create React hooks** for state management
5. **Build UI components** with optimistic updates
6. **Test cross-platform sync** thoroughly
7. **Deploy and monitor** for issues

---

## Questions?

Before implementing, verify:

1. **Do you have separate Firebase configs for dev/staging/prod?**
   - If yes, ensure all environments point to the same project as mobile
   
2. **Are you using React Query, SWR, or another data-fetching library?**
   - The hooks can be adapted to use these libraries instead of raw useState
   
3. **What's your auth context structure?**
   - You may need to adjust the `useAuth()` hook import path
   
4. **Do you want server-side rendering for the favorites list page?**
   - If yes, you'll need to use Firebase Admin SDK for initial data fetch
   
5. **What UI library are you using?**
   - Components above use Tailwind CSS, adjust if using other libraries
