import React, { useEffect, useState } from 'react';
import { db, auth, collection, doc, setDoc, getDocs, deleteDoc, query, where, onAuthStateChanged } from '../lib/firebase';
import { MissionConfig, RobotProfile, RobotConfig } from '../lib/types';
import { User } from 'firebase/auth';
import { Trash2, Save, Play } from 'lucide-react';

interface Props {
  currentMission: MissionConfig;
  setMission: React.Dispatch<React.SetStateAction<MissionConfig>>;
}

export function ProfileMissionManager({ currentMission, setMission }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [missions, setMissions] = useState<MissionConfig[]>([]);
  const [profiles, setProfiles] = useState<RobotProfile[]>([]);
  
  const [newMissionName, setNewMissionName] = useState('');
  const [newProfileName, setNewProfileName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadData(currentUser.uid);
      } else {
        setMissions([]);
        setProfiles([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadData = async (uid: string) => {
    try {
      const missionsQuery = query(collection(db, 'missions'), where('userId', '==', uid));
      const profilesQuery = query(collection(db, 'robotProfiles'), where('userId', '==', uid));

      const [missionsSnap, profilesSnap] = await Promise.all([
        getDocs(missionsQuery),
        getDocs(profilesQuery)
      ]);

      const loadedMissions = missionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionConfig));
      const loadedProfiles = profilesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RobotProfile));

      setMissions(loadedMissions);
      setProfiles(loadedProfiles);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveCurrentMission = async () => {
    if (!user) return;
    try {
      const missionId = currentMission.id || doc(collection(db, 'missions')).id;
      const missionData = {
        ...currentMission,
        id: missionId,
        userId: user.uid,
      };
      
      await setDoc(doc(db, 'missions', missionId), missionData);
      setMission(missionData);
      loadData(user.uid);
    } catch (error) {
      console.error('Error saving mission:', error);
    }
  };

  const createNewMission = async () => {
    if (!user || !newMissionName.trim()) return;
    try {
      const missionId = doc(collection(db, 'missions')).id;
      const newMission: MissionConfig = {
        ...currentMission,
        id: missionId,
        userId: user.uid,
        missionName: newMissionName.trim(),
        instructions: [], // Start fresh
      };
      await setDoc(doc(db, 'missions', missionId), newMission);
      setNewMissionName('');
      setMission(newMission);
      loadData(user.uid);
    } catch (error) {
      console.error('Error creating mission:', error);
    }
  };

  const deleteMission = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'missions', id));
      loadData(user.uid);
    } catch (error) {
      console.error('Error deleting mission:', error);
    }
  };

  const loadMission = (mission: MissionConfig) => {
    setMission(mission);
  };

  const saveCurrentRobotAsProfile = async () => {
    if (!user || !newProfileName.trim()) return;
    try {
      const profileId = doc(collection(db, 'robotProfiles')).id;
      const profileData: RobotProfile = {
        id: profileId,
        userId: user.uid,
        profileName: newProfileName.trim(),
        robotConfig: currentMission.robotConfig,
      };
      await setDoc(doc(db, 'robotProfiles', profileId), profileData);
      setNewProfileName('');
      loadData(user.uid);
    } catch (error) {
      console.error('Error saving robot profile:', error);
    }
  };

  const deleteProfile = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'robotProfiles', id));
      loadData(user.uid);
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const loadProfile = (profile: RobotProfile) => {
    setMission(prev => ({
      ...prev,
      robotConfig: profile.robotConfig
    }));
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <p className="mb-4">Please log in to manage missions and robot profiles.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-12">
      
      {/* Missions Section */}
      <section>
        <div className="flex justify-between items-end mb-6 border-b border-slate-800 pb-2">
          <h2 className="text-lg font-bold text-slate-200">My Missions</h2>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="New Mission Name" 
              value={newMissionName}
              onChange={e => setNewMissionName(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
            />
            <button onClick={createNewMission} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors">
              Create
            </button>
            <button onClick={saveCurrentMission} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ml-4">
              <Save size={14} /> Save Current
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {missions.map(m => (
            <div key={m.id} className={`bg-slate-900 border ${currentMission.id === m.id ? 'border-blue-500' : 'border-slate-700 hover:border-slate-500'} p-4 rounded-lg flex flex-col transition-colors`}>
              <h3 className="text-md font-bold text-white mb-1 truncate">{m.missionName}</h3>
              <p className="text-xs text-slate-400 mb-4">{m.instructions.length} Instructions</p>
              <div className="mt-auto flex justify-between items-center">
                <button onClick={() => loadMission(m)} className="text-blue-400 hover:text-blue-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <Play size={14} /> Load
                </button>
                <button onClick={() => deleteMission(m.id!)} className="text-red-500 hover:text-red-400 p-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {missions.length === 0 && (
            <p className="text-slate-500 italic">No missions saved yet.</p>
          )}
        </div>
      </section>

      {/* Robot Profiles Section */}
      <section>
        <div className="flex justify-between items-end mb-6 border-b border-slate-800 pb-2">
          <h2 className="text-lg font-bold text-slate-200">Robot Profiles</h2>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="New Profile Name" 
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
            />
            <button onClick={saveCurrentRobotAsProfile} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1">
              <Save size={14} /> Save Current Robot
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map(p => (
            <div key={p.id} className="bg-slate-900 border border-slate-700 hover:border-slate-500 p-4 rounded-lg flex flex-col transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.robotConfig.color }}></div>
                <h3 className="text-md font-bold text-white truncate">{p.profileName}</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                W:{p.robotConfig.width} H:{p.robotConfig.height} Arms:{p.robotConfig.arms.length}
              </p>
              <div className="mt-auto flex justify-between items-center">
                <button onClick={() => loadProfile(p)} className="text-blue-400 hover:text-blue-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <Play size={14} /> Apply Profile
                </button>
                <button onClick={() => deleteProfile(p.id!)} className="text-red-500 hover:text-red-400 p-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <p className="text-slate-500 italic">No robot profiles saved yet.</p>
          )}
        </div>
      </section>

    </div>
  );
}
