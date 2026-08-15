import { Member } from "../types";
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
  { key: 'jerseySize', label: 'Jersey / T-Shirt Size', type: 'select', options: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'], category: 'personal', categoryLabel: '1. Personal Identity', placeholder: 'Select size', required: true },
  { key: 'photoUrl', label: 'Choose Image', type: 'file', category: 'personal', categoryLabel: '1. Personal Identity', description: 'Upload a local image file (jpg, png, webp)', required: true },
  
  // Section 2: Contact & Social Details
  { key: 'email', label: 'Email Address', type: 'email', category: 'contact', categoryLabel: '2. Contact & Communications', placeholder: 'member@tarabariver.org', required: true },
  { key: 'phoneNumber', label: 'Phone Number', type: 'tel', category: 'contact', categoryLabel: '2. Contact & Communications', placeholder: '0803 123 4567', required: true },
  { key: 'whatsappNumber', label: 'WhatsApp Phone Number', type: 'tel', category: 'contact', categoryLabel: '2. Contact & Communications', placeholder: '0803 123 4567', required: true },
  
  // Section 3: Education & Unity School Background
  { key: 'schoolName', label: 'Unity School / High School Name', type: 'text', category: 'education', categoryLabel: '3. Unity School Alumni Background', placeholder: 'e.g. FGC Port Harcourt, FGGC Abuloma, FGC Wukari', required: true },
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
