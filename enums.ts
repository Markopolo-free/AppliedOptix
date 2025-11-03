export enum UserRole {
  Maker = 'Maker',
  Checker = 'Checker',
  Approver = 'Approver',
  Administrator = 'Administrator'
}

export enum ServiceStatus {
    Available = 'Available',
    Unavailable = 'Unavailable',
    Retired = 'Retired'
}

export enum PricingBasis {
    Distance = 'Distance (km)',
    Time = 'Time (hour)'
}

export enum UserGroup {
    Standard = 'Standard',
    Senior = 'Senior',
    Child = 'Child',
    Student = 'Student',
    Corporate = 'Corporate'
}

export enum DiscountType {
    Percentage = 'Percentage',
    Fixed = 'Fixed Amount'
}

export enum ZoneType {
    CityCenter = 'City Center',
    University = 'University',
    Park = 'Park',
    CommunityHub = 'Community Hub',
    TouristArea = 'Tourist Area',
}

export enum ApprovalStatus {
    Pending = 'Pending',
    Approved = 'Approved',
    Rejected = 'Rejected'
}
