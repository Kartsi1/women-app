/**
 * CommunityFeedScreen.tsx — Community tab root screen (COMM-01).
 *
 * UI-SPEC:
 *   - Screen title "Community" (Display/28px/700) in header
 *   - FlatList of PostCard, reverse-chronological, cursor-paginated
 *   - RefreshControl (accent spinner) refetches first page
 *   - onEndReached loads next page via getFeed(nextCursor) + appendPosts when hasMore && !isLoading
 *   - End-of-feed footer 'You've seen all posts' (Label/14px muted) when !hasMore
 *   - Empty state: 'Nothing here yet' / 'Be the first to post something for the community.'
 *   - FAB bottom-right 56×56dp accent #6200ea, Ionicons 'add', accessibilityLabel 'Create post'
 *   - On error: 'Feed couldn't load. Pull down to retry.'
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useFeedStore } from '../../store/feedStore';
import { getFeed } from '../../services/api';
import PostCard from '../../components/Community/PostCard';
import type { CommunityStackParamList } from '../../navigation/AppNavigator';
import type { Post } from '../../types/community';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CommunityFeed'>;

export default function CommunityFeedScreen({ navigation }: Props) {
  const {
    posts,
    nextCursor,
    hasMore,
    isLoading,
    setPosts,
    appendPosts,
    setIsLoading,
  } = useFeedStore();

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load the first page on mount
  useEffect(() => {
    loadFirstPage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFirstPage() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getFeed();
      if (res.error) {
        setError("Feed couldn't load. Pull down to retry.");
      } else {
        setPosts(
          (res.data ?? []) as Post[],
          res.nextCursor ?? null,
          res.hasMore ?? false
        );
      }
    } catch {
      setError("Feed couldn't load. Pull down to retry.");
    } finally {
      setIsLoading(false);
      setInitialLoaded(true);
    }
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await getFeed();
      if (res.error) {
        setError("Feed couldn't load. Pull down to retry.");
      } else {
        setPosts(
          (res.data ?? []) as Post[],
          res.nextCursor ?? null,
          res.hasMore ?? false
        );
      }
    } catch {
      setError("Feed couldn't load. Pull down to retry.");
    } finally {
      setRefreshing(false);
    }
  }, [setPosts]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoading || !nextCursor) return;
    setIsLoading(true);
    try {
      const res = await getFeed(nextCursor);
      if (!res.error && res.data) {
        appendPosts(
          res.data as Post[],
          res.nextCursor ?? null,
          res.hasMore ?? false
        );
      }
    } catch {
      // Non-fatal — user can pull to retry
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, nextCursor, appendPosts, setIsLoading]);

  // Footer component: spinner when loading more, end-of-feed when done
  function ListFooter() {
    if (isLoading && initialLoaded) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color="#6200ea" />
        </View>
      );
    }
    if (!hasMore && posts.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={styles.endOfFeed}>You've seen all posts</Text>
        </View>
      );
    }
    return null;
  }

  // Empty state
  function ListEmpty() {
    if (isLoading && !initialLoaded) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6200ea" />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyHeading}>Nothing here yet</Text>
        <Text style={styles.emptyBody}>
          Be the first to post something for the community.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Screen header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Community</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('PostDetail', { postId: item._id })}
            onCommentPress={() =>
              navigation.navigate('PostDetail', { postId: item._id, focusComment: true })
            }
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6200ea"
            colors={['#6200ea']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter />}
        ListEmptyComponent={<ListEmpty />}
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : undefined}
        style={styles.list}
      />

      {/* FAB — 56×56dp, accent #6200ea, Ionicons 'add' */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost')}
        accessibilityLabel="Create post"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  list: {
    flex: 1,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyHeading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 16,
    fontWeight: '400',
    color: '#777777',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#777777',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  endOfFeed: {
    fontSize: 14,
    fontWeight: '400',
    color: '#777777',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6200ea',
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for Android and iOS
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
