import { Member } from "../types";
import { UNITY_SCHOOLS_OPTIONS } from "./unitySchools";
export interface SchemaFieldDefinition {
  key: keyof Member;
  label: string;
  type: "text" | "email" | "tel" | "date" | "select" | "textarea" | "number" | "file";
  placeholder?: string;
  options?: string[];
  category:
    "personal" | "contact" | "education" | "residency" | "kin" | "community";
  categoryLabel: string;
  description?: string;
  required?: boolean;
}
export const MEMBER_DATABASE_SCHEMA: SchemaFieldDefinition[] = [
  // Section 1: Personal Information
  { key: 'title', label: 'Title', type: 'select', options: ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Engr.', 'Prof.', 'Chief'], category: 'personal', categoryLabel: '1. Personal Identity', placeholder: 'Select title', required: true },
  { key: 'firstName', label: 'First Name', type: 'text', category: 'personal', categoryLabel: '1. Personal Identity', placeholder: 'e.g. Bako', required: true },
  { key: 'surname', label: 'Surname / Last Name', type: 'text', category: 'personal', categoryLabel: '1. Personal Identity', placeholder: 'e.g. Danladi', required: true },
  { key: 'dateOfBirth', label: 'Birthday', type: 'text', category: 'personal', categoryLabel: '1. Personal Identity', placeholder: 'DD, MM (e.g. 15, August)', description: 'Used for community birthday celebrations', required: true },
  { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed'], category: 'personal', categoryLabel: '1. Personal Identity', placeholder: 'Select marital status', required: false },
  {
    key: 'jerseySize',
    label: 'Jersey / T-Shirt Size',
    type: 'select',
    options: [
      'Asian XS (CH 36" Chest)',
      'Asian S (US XXS / CH 38")',
      'Asian M (US XS / CH 40")',
      'Asian L (US S / CH 42")',
      'Asian XL (US M / CH 44")',
      'Asian XXL (US L / CH 46")',
      'Asian 3XL (US XL / CH 48")',
      'Asian 4XL (US XXL / CH 50")',
      'Asian 5XL (US 3XL / CH 52")',
      'Asian 6XL (US 4XL / CH 54")',
      'Asian 7XL (US 5XL / CH 56")',
      'Asian 8XL (US 6XL / CH 58")',
      'Asian 9XL (US 7XL / CH 60")',
      'Asian 10XL (US 8XL / CH 62")',
      'Asian 11XL (US 9XL / CH 64")',
      'US XXS (Asian S / CH 38")',
      'US XS (Asian M / CH 40")',
      'US S (Asian L / CH 42")',
      'US M (Asian XL / CH 44")',
      'US L (Asian XXL / CH 46")',
      'US XL (Asian 3XL / CH 48")',
      'US XXL (Asian 4XL / CH 50")',
      'US 3XL (Asian 5XL / CH 52")',
      'US 4XL (Asian 6XL / CH 54")',
      'US 5XL (Asian 7XL / CH 56")',
      'US 6XL (Asian 8XL / CH 58")',
      'US 7XL (Asian 9XL / CH 60")',
      'US 8XL (Asian 10XL / CH 62")',
      'US 9XL (Asian 11XL / CH 64")'
    ],
    category: 'personal',
    categoryLabel: '1. Personal Identity',
    placeholder: 'Select Asian or US size',
    description: 'Lay shirt flat, measure armpit to armpit and double it = CH (chest size)',
    required: true
  },
  { key: 'photoUrl', label: 'Choose Image', type: 'file', category: 'personal', categoryLabel: '1. Personal Identity', description: 'Upload a local image file (jpg, png, webp)', required: true },
  
  // Section 2: Contact & Social Details
  { key: 'email', label: 'Email Address', type: 'email', category: 'contact', categoryLabel: '2. Contact & Communications', placeholder: 'member@tarabariver.org', required: true },
  { key: 'phoneNumber', label: 'Phone Number', type: 'tel', category: 'contact', categoryLabel: '2. Contact & Communications', placeholder: '0803 123 4567', required: true },
  { key: 'whatsappNumber', label: 'WhatsApp Phone Number', type: 'tel', category: 'contact', categoryLabel: '2. Contact & Communications', placeholder: '0803 123 4567', required: true },
  
  // Section 3: Education & Unity School Background
  {
    key: 'schoolName',
    label: 'Unity School / Alma Mater (115 Federal Unity Colleges)',
    type: 'select',
    options: UNITY_SCHOOLS_OPTIONS,
    category: 'education',
    categoryLabel: '3. Unity School Alumni Background',
    placeholder: 'Select from 115 Federal Unity Colleges',
    description: 'Complete list of 115 Federal Unity Colleges across Nigeria as of 2026',
    required: true
  },
  { key: 'gradYear', label: 'Graduation / Set Year', type: 'text', category: 'education', categoryLabel: '3. Unity School Alumni Background', placeholder: 'e.g. 1998', required: true },
  { key: 'occupation', label: 'Occupation / Profession', type: 'text', category: 'education', categoryLabel: '3. Unity School Alumni Background', placeholder: 'e.g. Environmental Engineer, Medical Doctor, Teacher', required: true },
  { key: 'skills', label: 'Skills & Expertise (Comma-separated)', type: 'text', category: 'education', categoryLabel: '3. Unity School Alumni Background', placeholder: 'e.g. Healthcare, Engineering, Community Support, First Aid', required: false },
  
  // Section 4: Residency & Location Details
  { key: 'estateName', label: 'Estate / Housing Layout Name', type: 'text', category: 'residency', categoryLabel: '4. Residence & Address Details', placeholder: 'e.g. Somiari Estate, Olumati Estate', required: true },
  { key: 'area', label: 'Area / District', type: 'text', category: 'residency', categoryLabel: '4. Residence & Address Details', placeholder: 'e.g. Rumuodara, Choba, Woji, Ada George', required: true },
  { key: 'otherArea', label: 'Other Area / Landmark', type: 'text', category: 'residency', categoryLabel: '4. Residence & Address Details', placeholder: 'e.g. Mgbuogba', required: false },
  { key: 'streetName', label: 'Street Name', type: 'text', category: 'residency', categoryLabel: '4. Residence & Address Details', placeholder: 'e.g. Youth Avenue, Off Okporo Road', required: true },
  
  // Section 5: Next of Kin & Emergency Contacts
  { key: 'nextOfKinName', label: 'Next of Kin Name', type: 'text', category: 'kin', categoryLabel: '5. Next of Kin & Emergency Contacts', placeholder: 'Full name of Next of Kin', required: true },
  { key: 'nextOfKinPhone', label: 'Next of Kin Phone Number', type: 'tel', category: 'kin', categoryLabel: '5. Next of Kin & Emergency Contacts', placeholder: '0803 000 0000', required: true },
  { key: 'closestNeighborName', label: 'Closest Neighbor Name', type: 'text', category: 'kin', categoryLabel: '5. Next of Kin & Emergency Contacts', placeholder: 'Name of closest neighbor', required: true },
  { key: 'closestNeighborPhone', label: 'Closest Neighbor Phone Number', type: 'tel', category: 'kin', categoryLabel: '5. Next of Kin & Emergency Contacts', placeholder: '0803 000 0000', required: true }
];
