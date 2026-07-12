const fs = require('fs');
const path = require('path');

function refactorMessages() {
  const filePath = path.join('src', 'pages', 'Messages.tsx');
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1. Memoize arrays
  const filterBlockRegex = /\/\/ Filter functions[\s\S]*?(?=\/\/ Create group\/channel handlers)/;
  
  const newFilterBlock = `// Filter functions memoized
  const filteredConversations = useMemo(() => {
    return (conversations ?? []).filter((conv) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = conv.otherUser.name?.toLowerCase() || "";
      const username = conv.otherUser.username?.toLowerCase() || "";
      return name.includes(q) || username.includes(q);
    });
  }, [conversations, searchQuery]);

  const filteredGroups = useMemo(() => {
    return (groups ?? []).filter((g) => {
      if (!searchQuery) return true;
      return g.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [groups, searchQuery]);

  const filteredChannels = useMemo(() => {
    return (channels ?? []).filter((c) => {
      if (!searchQuery) return true;
      return c.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [channels, searchQuery]);

  const filteredFollowers = useMemo(() => {
    return followers.filter((f) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = f.name?.toLowerCase() || "";
      const username = f.username?.toLowerCase() || "";
      return name.includes(q) || username.includes(q);
    });
  }, [followers, searchQuery]);

  const filteredFollowing = useMemo(() => {
    return following.filter((f) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = f.name?.toLowerCase() || "";
      const username = f.username?.toLowerCase() || "";
      return name.includes(q) || username.includes(q);
    });
  }, [following, searchQuery]);

  // Combine and sort all chats for the "All" tab
  const allChats = useMemo(() => {
    return [
      ...filteredConversations.map(conv => ({ ...conv, chatType: 'direct' as const, sortTime: conv.last_message_at || new Date(0).toISOString() })),
      ...filteredGroups.map(group => ({ ...group, chatType: 'group' as const, sortTime: group.lastMessage?.created_at || group.created_at })),
      ...filteredChannels.map(channel => ({ ...channel, chatType: 'channel' as const, sortTime: channel.lastMessage?.created_at || channel.created_at }))
    ].sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());
  }, [filteredConversations, filteredGroups, filteredChannels]);

  `;

  content = content.replace(filterBlockRegex, newFilterBlock);

  // Write changes
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Memoized arrays successfully.');
}

refactorMessages();
