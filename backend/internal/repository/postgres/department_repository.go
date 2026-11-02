package postgres

import (
	"context"
	"errors"
	"strings"

	"deskflow/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DepartmentRepository struct {
	db *gorm.DB
}

func NewDepartmentRepository(db *gorm.DB) *DepartmentRepository {
	return &DepartmentRepository{db: db}
}

func (r *DepartmentRepository) List(ctx context.Context) ([]*domain.Department, error) {
	var departments []*domain.Department
	err := r.db.WithContext(ctx).Order("name ASC").Find(&departments).Error
	return departments, err
}

func (r *DepartmentRepository) Create(ctx context.Context, department *domain.Department) error {
	if department == nil {
		return domain.ErrInvalidInput
	}
	department.Name = strings.TrimSpace(department.Name)
	if department.Name == "" || len(department.Name) > 100 {
		return domain.ErrInvalidInput
	}
	err := r.db.WithContext(ctx).Create(department).Error
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return domain.ErrDepartmentExists
	}
	return err
}

func (r *DepartmentRepository) Rename(ctx context.Context, oldName, newName string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var department domain.Department
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&department, "name = ?", oldName).Error; err != nil {
			return err
		}
		var existing domain.Department
		if err := tx.First(&existing, "name = ?", newName).Error; err == nil {
			return domain.ErrDepartmentExists
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Model(&domain.User{}).Where("department = ?", oldName).Update("department", newName).Error; err != nil {
			return err
		}
		if err := tx.Model(&domain.Ticket{}).Where("department = ?", oldName).Update("department", newName).Error; err != nil {
			return err
		}
		return tx.Model(&department).Update("name", newName).Error
	})
}

func (r *DepartmentRepository) Delete(ctx context.Context, name string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var department domain.Department
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&department, "name = ?", name).Error; err != nil {
			return err
		}
		var userCount, ticketCount int64
		if err := tx.Model(&domain.User{}).Where("department = ?", name).Count(&userCount).Error; err != nil {
			return err
		}
		if err := tx.Model(&domain.Ticket{}).Where("department = ?", name).Count(&ticketCount).Error; err != nil {
			return err
		}
		if userCount > 0 || ticketCount > 0 {
			return domain.ErrDepartmentInUse
		}
		return tx.Delete(&department).Error
	})
}
