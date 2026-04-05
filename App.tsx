import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, useColorScheme, 
  StatusBar, FlatList, Modal, TextInput, Alert, KeyboardAvoidingView, 
  Platform, ScrollView, Switch, LayoutAnimation, UIManager, BackHandler
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const REAL_CATEGORIES = ['🏸 运动', '💻 工作', '🏠 生活', '📚 学习', '✨ 其他'];
const FILTER_CATEGORIES = ['全部', ...REAL_CATEGORIES];

interface Step {
  id: string;
  name: string;
  isCompleted: boolean;
}

interface Habit {
  id: string;
  name: string;
  memo: string;
  createdAt: string;
  todayCount: number;
  totalCount: number;
  steps: Step[];
  category: string;
  isTriggerMode: boolean;
}

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';
  
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activeCategory, setActiveCategory] = useState('全部');
  
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [newCategory, setNewCategory] = useState(REAL_CATEGORIES[0]);

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editStepName, setEditStepName] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [modalToastVisible, setModalToastVisible] = useState(false);
  const [modalToastMessage, setModalToastMessage] = useState('');

  useEffect(() => { loadData(); }, []);

  // --- 侧滑手势拦截引擎 ---
  useEffect(() => {
    const backAction = () => {
      // 如果当前是多选模式，我们就拦截侧滑！
      if (isSelectionMode) {
        Alert.alert("退出多选", "已选中项目尚未操作，是否退出多选模式？", [
          { text: "取消", style: "cancel", onPress: () => null },
          { 
            text: "确定退出", 
            style: "destructive",
            onPress: () => toggleSelectionMode() // 调用我们写好的退出多选函数
          }
        ]);
        return true; // 返回 true 告诉手机：“我处理了，你别把我退回桌面！”
      }
      return false; // 如果不是多选模式，就按手机默认的来
    };

    // 监听安卓的物理返回键/侧滑手势
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    // 清理函数
    return () => backHandler.remove();
  }, [isSelectionMode]); // 依赖项：每次进入/退出多选模式，引擎都会重新评估

  const loadData = async () => {
    try {
      const storedHabits = await AsyncStorage.getItem('@mint_habits_v3');
      const storedDate = await AsyncStorage.getItem('@mint_date');
      const todayString = new Date().toDateString();

      let parsedHabits: Habit[] = storedHabits ? JSON.parse(storedHabits) : [];

      if (storedDate !== todayString) {
        parsedHabits = parsedHabits.map(habit => ({ 
          ...habit, 
          todayCount: 0,
          steps: habit.steps ? habit.steps.map(s => ({ ...s, isCompleted: false })) : []
        }));
        await AsyncStorage.setItem('@mint_date', todayString);
        await AsyncStorage.setItem('@mint_habits_v3', JSON.stringify(parsedHabits));
      }

      parsedHabits = parsedHabits.map(h => ({ 
        ...h, 
        steps: h.steps || [],
        category: h.category || '✨ 其他',
        isTriggerMode: h.isTriggerMode || false
      }));
      setHabits(parsedHabits);
    } catch (e) { console.error("读取失败", e); }
  };

  const saveHabits = async (newHabits: Habit[]) => {
    setHabits(newHabits);
    await AsyncStorage.setItem('@mint_habits_v3', JSON.stringify(newHabits));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg); setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  const showModalToast = (msg: string) => {
    setModalToastMessage(msg); setModalToastVisible(true);
    setTimeout(() => setModalToastVisible(false), 2000);
  };

  const addHabit = async () => {
    if (!newName.trim()) return Alert.alert("提示", "名字不能为空哦~");
    const newHabit: Habit = {
      id: Date.now().toString(), name: newName.trim(), memo: newMemo.trim(),
      createdAt: new Date().toDateString(), todayCount: 0, totalCount: 0,
      steps: [], category: newCategory, isTriggerMode: false,
    };
    await saveHabits([...habits, newHabit]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddModalVisible(false); setNewName(''); setNewMemo('');
  };

  const handlePunch = async (id: string, silent = false) => {
    if (!silent) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedHabits = habits.map(habit => 
      habit.id === id ? { ...habit, todayCount: habit.todayCount + 1, totalCount: habit.totalCount + 1 } : habit
    );
    await saveHabits(updatedHabits);
  };

  const onCardPress = (id: string) => {
    if (isSelectionMode) {
      Haptics.selectionAsync();
      setSelectedHabitIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      handlePunch(id);
    }
  };

  const onCardLongPress = (habit: Habit) => {
    if (isSelectionMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setEditingHabit(habit);
    setEditModalVisible(true);
  };

  const toggleSelectionMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSelectionMode(!isSelectionMode);
    setSelectedHabitIds([]);
  };

  const updateEditingHabitSilently = async (updater: (prev: Habit) => Habit) => {
    if (!editingHabit) return;
    const updated = updater(editingHabit);
    setEditingHabit(updated);
    const newHabits = habits.map(h => h.id === updated.id ? updated : h);
    setHabits(newHabits);
    await AsyncStorage.setItem('@mint_habits_v3', JSON.stringify(newHabits));
  };

  const toggleStep = async (habitId: string, stepId: string) => {
    const targetHabit = habits.find(h => h.id === habitId);
    if (!targetHabit) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (targetHabit.isTriggerMode) {
      const stepName = targetHabit.steps.find(s => s.id === stepId)?.name;
      handlePunch(habitId, true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`⚡ 触发成功：${stepName} (+1)`);
      return;
    }

    let isAllCompletedNow = false;
    let targetHabitName = "";
    const updatedHabits = habits.map(habit => {
      if (habit.id === habitId) {
        targetHabitName = habit.name;
        const updatedSteps = habit.steps.map(step => step.id === stepId ? { ...step, isCompleted: !step.isCompleted } : step);
        if (updatedSteps.length > 0 && updatedSteps.every(s => s.isCompleted)) isAllCompletedNow = true;
        return { ...habit, steps: updatedSteps };
      }
      return habit;
    });

    await saveHabits(updatedHabits);
    if (editingHabit?.id === habitId) setEditingHabit(updatedHabits.find(h => h.id === habitId) || null);

    if (isAllCompletedNow) {
      setTimeout(async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const finalHabits = updatedHabits.map(h => h.id === habitId ? { ...h, todayCount: h.todayCount + 1, totalCount: h.totalCount + 1, steps: h.steps.map(s => ({ ...s, isCompleted: false })) } : h);
        await saveHabits(finalHabits);
        if (editingHabit?.id === habitId) setEditingHabit(finalHabits.find(h => h.id === habitId) || null);
        Alert.alert("太棒了！", `「${targetHabitName}」的所有子项目已完成，打卡次数 +1！`);
      }, 500);
    }
  };

  const handleBatchPunch = async () => {
    if (selectedHabitIds.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updatedHabits = habits.map(h => selectedHabitIds.includes(h.id) ? { ...h, todayCount: h.todayCount + 1, totalCount: h.totalCount + 1 } : h);
    await saveHabits(updatedHabits);
    toggleSelectionMode();
    showToast(`✨ 成功为 ${selectedHabitIds.length} 个项目打卡`);
  };

  const handleBatchDelete = () => {
    if (selectedHabitIds.length === 0) return;
    Alert.alert("确认", `确定要删除选中的 ${selectedHabitIds.length} 个项目吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
          const updatedHabits = habits.filter(h => !selectedHabitIds.includes(h.id));
          await saveHabits(updatedHabits);
          toggleSelectionMode();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }
    ]);
  };

  const calculateDays = (dateString: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24));
    return diff + 1;
  };

  const theme = isDarkMode ? styles.darkTheme : styles.lightTheme;
  const textColor = isDarkMode ? '#FFFFFF' : '#333333';
  const cardBg = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const subTextColor = isDarkMode ? '#AAAAAA' : '#666666';

  const filteredHabits = habits
    .filter(h => activeCategory === '全部' || h.category === activeCategory)
    .filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderItem = ({ item }: { item: Habit }) => {
    const isExpanded = expandedCards[item.id];
    const stepsToShow = (item.steps.length > 3 && !isExpanded) ? item.steps.slice(0, 3) : item.steps;
    const isSelected = selectedHabitIds.includes(item.id);

    return (
      <TouchableOpacity 
        style={[
          styles.card, 
          { backgroundColor: cardBg }, 
          isSelected && styles.cardSelected
        ]}
        onPress={() => onCardPress(item.id)}
        onLongPress={() => onCardLongPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {isSelectionMode && (
              <Feather 
                name={isSelected ? "check-circle" : "circle"} 
                size={22} 
                color={isSelected ? "#A3E4D7" : subTextColor} 
                style={{ marginRight: 10 }} 
              />
            )}
            <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>{item.name}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.daysBadge}>第 {calculateDays(item.createdAt)} 天</Text>
            {!isSelectionMode && (
              <TouchableOpacity onPress={() => onCardLongPress(item)} style={{ padding: 5, marginLeft: 10 }}>
                <Feather name="more-horizontal" size={24} color={subTextColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {item.memo ? <Text style={[styles.cardMemo, isSelectionMode && { opacity: 0.5 }]}>{item.memo}</Text> : null}
        
        {item.steps && item.steps.length > 0 && !isSelectionMode && (
          <View style={styles.stepsPreview}>
            {stepsToShow.map(step => (
              <TouchableOpacity key={step.id} style={styles.stepPreviewItem} onPress={() => toggleStep(item.id, step.id)}>
                <Feather name={item.isTriggerMode ? "zap" : (step.isCompleted ? "check-circle" : "circle")} size={18} color={item.isTriggerMode ? "#FFD700" : (step.isCompleted ? "#A3E4D7" : subTextColor)} />
                <Text style={[styles.stepPreviewText, { color: step.isCompleted && !item.isTriggerMode ? '#A3E4D7' : subTextColor, textDecorationLine: step.isCompleted && !item.isTriggerMode ? 'line-through' : 'none' }]}>
                  {step.name}
                </Text>
              </TouchableOpacity>
            ))}
            {item.steps.length > 3 && (
              <TouchableOpacity style={styles.expandBtn} onPress={() => { Haptics.selectionAsync(); setExpandedCards(prev => ({ ...prev, [item.id]: !prev[item.id] })); }}>
                <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={subTextColor} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={[styles.cardStats, isSelectionMode && { opacity: 0.5 }]}>
          <View style={styles.statGroup}><Text style={styles.statLabel}>今日</Text><Text style={styles.statNumber}>{item.todayCount}</Text></View>
          <View style={styles.statGroup}><Text style={styles.statLabel}>总计</Text><Text style={styles.statNumberTotal}>{item.totalCount}</Text></View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, theme]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {toastVisible && <View style={styles.toastContainer}><Text style={styles.toastText}>{toastMessage}</Text></View>}

      <View style={styles.header}>
        {isSearchExpanded ? (
          <View style={styles.searchExpandedContainer}>
            <Feather name="search" size={20} color="#888" style={{ marginLeft: 15 }} />
            <TextInput style={[styles.searchInput, { color: textColor }]} placeholder="搜索..." placeholderTextColor="#888" value={searchQuery} onChangeText={setSearchQuery} autoFocus />
            <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsSearchExpanded(false); setSearchQuery(''); }} style={{ padding: 10 }}>
              <Feather name="x" size={20} color={textColor} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View>
              <Text style={[styles.title, { color: textColor }]}>Project Mint</Text>
              <Text style={[styles.subtitle, { color: textColor }]}>历历浮生，无非败而后成。</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsSearchExpanded(true); }} style={styles.iconBtn}>
                <Feather name="search" size={22} color={textColor} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleSelectionMode} style={styles.iconBtn}>
                <Feather name={isSelectionMode ? "x-square" : "check-square"} size={22} color={textColor} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {FILTER_CATEGORIES.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.categoryPill, activeCategory === cat ? styles.categoryPillActive : { backgroundColor: isDarkMode ? '#2C2C2C' : '#EAEAEA' }]}
              onPress={() => { Haptics.selectionAsync(); setActiveCategory(cat); }}
            >
              <Text style={[styles.categoryText, activeCategory === cat ? { color: '#1A3622', fontWeight: 'bold' } : { color: subTextColor }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredHabits}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>还没种下薄荷哦</Text>}
      />

      {isSelectionMode ? (
        <View style={[styles.batchConsole, { backgroundColor: isDarkMode ? '#2C2C2C' : '#FFFFFF' }]}>
          <TouchableOpacity onPress={toggleSelectionMode} style={styles.batchBtnOutline}><Text style={{ color: subTextColor }}>取消</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleBatchDelete} style={[styles.batchBtn, { backgroundColor: '#FF6B6B' }]}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>批量删除</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleBatchPunch} style={[styles.batchBtn, { backgroundColor: '#A3E4D7' }]}><Text style={{ color: '#1A3622', fontWeight: 'bold' }}>一键打卡</Text></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={() => { Haptics.selectionAsync(); setAddModalVisible(true); }}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={isAddModalVisible} animationType="fade" transparent={true} onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#2C2C2C' : '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>新的挑战</Text>
            <TextInput style={[styles.input, { color: textColor, borderColor: isDarkMode ? '#555' : '#E0E0E0' }]} placeholder="打卡名称" placeholderTextColor="#888" value={newName} onChangeText={setNewName} maxLength={15} />
            <TextInput style={[styles.input, { color: textColor, borderColor: isDarkMode ? '#555' : '#E0E0E0' }]} placeholder="（可选）简短备注" placeholderTextColor="#888" value={newMemo} onChangeText={setNewMemo} maxLength={25} />
            
            <Text style={styles.inputLabel}>选择分类</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {REAL_CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} style={[styles.categoryPill, newCategory === cat ? styles.categoryPillActive : { backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5' }]} onPress={() => setNewCategory(cat)}>
                  <Text style={[styles.categoryText, newCategory === cat ? { color: '#1A3622', fontWeight: 'bold' } : { color: subTextColor }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: 'transparent' }]} onPress={() => setAddModalVisible(false)}><Text style={{ color: '#888', fontSize: 16 }}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#A3E4D7' }]} onPress={addHabit}><Text style={{ color: '#1A3622', fontSize: 16, fontWeight: 'bold' }}>种下薄荷</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isEditModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.bottomSheetOverlay}>
          {modalToastVisible && <View style={[styles.toastContainer, { top: -50 }]}><Text style={styles.toastText}>{modalToastMessage}</Text></View>}

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', maxHeight: '90%' }}>
            <View style={[styles.bottomSheetContent, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF' }]}>
              <View style={styles.sheetHandle} />
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <Text style={[styles.sheetTitle, { color: textColor }]}>{editingHabit?.name}</Text>
                  <Text style={{ color: '#A3E4D7', fontSize: 14, fontWeight: 'bold' }}>与它相伴的第 {editingHabit ? calculateDays(editingHabit.createdAt) : 0} 天</Text>
                </View>

                <Text style={styles.inputLabel}>名称</Text>
                <TextInput style={[styles.input, { color: textColor, borderColor: isDarkMode ? '#555' : '#E0E0E0' }]} value={editingHabit?.name} onChangeText={(text) => updateEditingHabitSilently(prev => ({ ...prev, name: text }))} />

                <Text style={styles.inputLabel}>备注</Text>
                <TextInput style={[styles.input, { color: textColor, borderColor: isDarkMode ? '#555' : '#E0E0E0' }]} value={editingHabit?.memo} onChangeText={(text) => updateEditingHabitSilently(prev => ({ ...prev, memo: text }))} />

                <Text style={styles.inputLabel}>分类</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                  {REAL_CATEGORIES.map(cat => (
                    <TouchableOpacity key={cat} style={[styles.categoryPill, editingHabit?.category === cat ? styles.categoryPillActive : { backgroundColor: isDarkMode ? '#2C2C2C' : '#F5F5F5' }]} onPress={() => { updateEditingHabitSilently(prev => ({ ...prev, category: cat })); showModalToast("✨ 分类已更新"); }}>
                      <Text style={[styles.categoryText, editingHabit?.category === cat ? { color: '#1A3622', fontWeight: 'bold' } : { color: subTextColor }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.switchRow}>
                  <View>
                    <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>⚡ 快捷触发模式</Text>
                    <Text style={{ color: subTextColor, fontSize: 12, marginTop: 4 }}>开启后，点击子步骤直接打卡+1，不要求全选</Text>
                  </View>
                  <Switch 
                    value={editingHabit?.isTriggerMode} 
                    onValueChange={(val) => { updateEditingHabitSilently(prev => ({ ...prev, isTriggerMode: val })); showModalToast(val ? "⚡ 已切换为触发模式" : "🔗 已切换为连招模式"); }}
                    trackColor={{ false: '#767577', true: '#A3E4D7' }}
                    thumbColor={editingHabit?.isTriggerMode ? '#1A3622' : '#f4f3f4'}
                  />
                </View>

                <Text style={styles.inputLabel}>子步骤管理</Text>
                {editingHabit?.steps.map(step => (
                  <View key={step.id} style={styles.editStepRow}>
                    <TextInput style={[styles.stepEditInput, { color: textColor }]} value={step.name} onChangeText={(text) => updateEditingHabitSilently(prev => ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, name: text } : s) }))} placeholder="步骤名称..." placeholderTextColor="#888" />
                    <TouchableOpacity onPress={() => { updateEditingHabitSilently(prev => ({ ...prev, steps: prev.steps.filter(s => s.id !== step.id) })); showModalToast("🗑️ 步骤已删除"); }} style={{ padding: 5 }}>
                      <Feather name="trash-2" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                <View style={styles.addStepContainer}>
                  <TextInput style={[styles.stepInput, { color: textColor, backgroundColor: isDarkMode ? '#2C2C2C' : '#F5F5F5' }]} placeholder="添加新步骤..." placeholderTextColor="#888" value={editStepName} onChangeText={setEditStepName} />
                  <TouchableOpacity style={styles.addStepBtn} onPress={() => { if (!editStepName.trim() || !editingHabit) return; updateEditingHabitSilently(prev => ({ ...prev, steps: [...prev.steps, { id: Date.now().toString(), name: editStepName.trim(), isCompleted: false }] })); setEditStepName(''); showModalToast("✨ 新步骤已添加"); }}>
                    <Feather name="plus" size={20} color="#1A3622" />
                  </TouchableOpacity>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => { Alert.alert("残忍删除", "确定放弃吗？", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: async () => { const updatedHabits = habits.filter(h => h.id !== editingHabit?.id); await saveHabits(updatedHabits); setEditModalVisible(false); } }]); }}>
                    <Feather name="trash" size={18} color="#FF6B6B" style={{ marginRight: 5 }} />
                    <Text style={{ color: '#FF6B6B', fontWeight: 'bold' }}>删除项目</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: 'rgba(163, 228, 215, 0.2)', paddingHorizontal: 20 }]} onPress={() => setEditModalVisible(false)}>
                    <Text style={{ color: '#4E9F8F', fontWeight: 'bold' }}>关闭面板</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lightTheme: { backgroundColor: '#F5F7F5' },
  darkTheme: { backgroundColor: '#121212' },
  
  toastContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, alignSelf: 'center', backgroundColor: '#A3E4D7', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, zIndex: 9999, shadowColor: '#A3E4D7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
  toastText: { color: '#1A3622', fontWeight: 'bold', fontSize: 14 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight! + 20, paddingBottom: 15 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  subtitle: { fontSize: 12, opacity: 0.6, marginTop: 2, letterSpacing: 1 },
  iconBtn: { padding: 8, marginLeft: 10 },
  
  searchExpandedContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.1)', borderRadius: 20, height: 45 },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 16 },

  categoryContainer: { marginBottom: 15 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  categoryPillActive: { backgroundColor: '#A3E4D7', shadowColor: '#A3E4D7', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  categoryText: { fontSize: 14, fontWeight: '600' },

  listContainer: { paddingHorizontal: 20, paddingBottom: 120 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#888', lineHeight: 24, paddingHorizontal: 20 },
  
  card: { 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 15, 
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 3 
  },
  cardSelected: { 
    borderColor: '#A3E4D7',
  },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 20, fontWeight: 'bold' },
  daysBadge: { backgroundColor: 'rgba(163, 228, 215, 0.2)', color: '#4E9F8F', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  cardMemo: { fontSize: 14, color: '#888', marginBottom: 15 },
  
  stepsPreview: { marginBottom: 15, backgroundColor: 'rgba(128,128,128,0.05)', padding: 10, borderRadius: 10 },
  stepPreviewItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  stepPreviewText: { marginLeft: 10, fontSize: 14 },
  expandBtn: { alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.1)' },

  cardStats: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
  statGroup: { marginRight: 30, alignItems: 'center', flexDirection: 'row' },
  statLabel: { fontSize: 12, color: '#888', marginRight: 8 },
  statNumber: { fontSize: 28, fontWeight: '900', color: '#A3E4D7' },
  statNumberTotal: { fontSize: 20, fontWeight: 'bold', color: '#888', opacity: 0.6 },
  
  fab: { position: 'absolute', bottom: 40, right: 30, width: 66, height: 66, borderRadius: 33, backgroundColor: '#A3E4D7', alignItems: 'center', justifyContent: 'center', shadowColor: '#A3E4D7', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  fabText: { fontSize: 36, color: '#1A3622', fontWeight: '300', marginTop: -4 },
  
  batchConsole: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, flexDirection: 'row', justifyContent: 'space-between', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 15 },
  batchBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  batchBtnOutline: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#888' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 24, padding: 25 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, justifyContent: 'center', marginHorizontal: 5 },

  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheetContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 25 },
  sheetHandle: { width: 40, height: 5, backgroundColor: '#CCC', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  inputLabel: { fontSize: 14, color: '#888', marginBottom: 8, fontWeight: 'bold' },
  
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.05)', padding: 15, borderRadius: 12, marginBottom: 20 },
  
  editStepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.1)', marginBottom: 5 },
  stepEditInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  addStepContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 30 },
  stepInput: { flex: 1, height: 45, borderRadius: 10, paddingHorizontal: 15 },
  addStepBtn: { width: 45, height: 45, backgroundColor: '#A3E4D7', borderRadius: 10, marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
  
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10 },
});